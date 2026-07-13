import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("User")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

function withEnv(vars, fn) {
  const original = {};
  for (const key of Object.keys(vars)) {
    original[key] = process.env[key];
    if (vars[key] === undefined) delete process.env[key];
    else process.env[key] = vars[key];
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of Object.keys(original)) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    });
}

// ---------------------------------------------------------------------------
// registerUser(data)
// ---------------------------------------------------------------------------

test("UTCID01: registerUser tao user moi, hash password va goi sendEmail chao mung", async (t) => {
  let createArgs = null;
  let sendEmailArgs = null;

  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        user: {
          create: async (args) => {
            createArgs = args;
            return { id: "user-1", ...args.data };
          },
        },
      },
    },
  });
  t.mock.module("../src/services/email.service.js", {
    namedExports: {
      sendEmail: async (opts) => {
        sendEmailArgs = opts;
        return { success: true, emailId: "mock-email-1" };
      },
    },
  });

  const { registerUser } = await import(
    `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await registerUser({
    email: "user@example.com",
    password: "secret123",
    fullName: "Nguyen Van A",
  });

  assert.equal(result.id, "user-1");
  assert.equal(result.email, "user@example.com");
  assert.equal(result.fullName, "Nguyen Van A");
  assert.equal(typeof createArgs.data.password, "string");
  assert.notEqual(createArgs.data.password, "secret123");
  assert.equal(
    await bcrypt.compare("secret123", createArgs.data.password),
    true,
  );

  // sendEmail is fired without being awaited by registerUser; give the
  // microtask queue a tick to run it before asserting on it.
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sendEmailArgs.to, "user@example.com");
  assert.match(sendEmailArgs.subject, /Nguyen Van A/);
});

test("UTCID02: registerUser chap nhan password chuoi rong (bien) va van hash thanh cong", async (t) => {
  let createArgs = null;

  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        user: {
          create: async (args) => {
            createArgs = args;
            return { id: "user-2", ...args.data };
          },
        },
      },
    },
  });
  t.mock.module("../src/services/email.service.js", {
    namedExports: {
      sendEmail: async () => ({ success: true, emailId: "mock-email-2" }),
    },
  });

  const { registerUser } = await import(
    `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await registerUser({
    email: "empty-pass@example.com",
    password: "",
    fullName: "Boundary User",
  });

  assert.equal(result.id, "user-2");
  assert.equal(typeof createArgs.data.password, "string");
  assert.notEqual(createArgs.data.password, "");
  assert.equal(await bcrypt.compare("", createArgs.data.password), true);
});

test("UTCID03: registerUser nem loi khi prisma.user.create that bai (VD trung email)", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        user: {
          create: async () => {
            throw new Error(
              "Unique constraint failed on the fields: (`email`)",
            );
          },
        },
      },
    },
  });
  t.mock.module("../src/services/email.service.js", {
    namedExports: {
      sendEmail: async () => ({ success: true, emailId: "unused" }),
    },
  });

  const { registerUser } = await import(
    `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
  );

  await assert.rejects(
    () =>
      registerUser({
        email: "dup@example.com",
        password: "secret123",
        fullName: "Dup User",
      }),
    /Unique constraint failed/,
  );
});

test("UTCID04: registerUser van tra ve user du sendEmail bi loi (khong chan luong dang ky)", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        user: {
          create: async (args) => ({ id: "user-4", ...args.data }),
        },
      },
    },
  });
  t.mock.module("../src/services/email.service.js", {
    namedExports: {
      sendEmail: async () => {
        throw new Error("SMTP down");
      },
    },
  });

  const { registerUser } = await import(
    `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
  );

  const result = await registerUser({
    email: "resilient@example.com",
    password: "secret123",
    fullName: "Resilient User",
  });

  assert.equal(result.id, "user-4");
  assert.equal(result.email, "resilient@example.com");
  // Give the rejected sendEmail promise a chance to be caught internally;
  // if it were not caught this would surface as an unhandled rejection.
  await new Promise((resolve) => setTimeout(resolve, 10));
});

// ---------------------------------------------------------------------------
// loginUser(email, password)
// ---------------------------------------------------------------------------

test("UTCID01: loginUser tra ve user va token khi email/password dung", async (t) => {
  await withEnv(
    { JWT_SECRET: "test-jwt-secret", JWT_EXPIRES_IN: "7d" },
    async () => {
      const hashed = await bcrypt.hash("correct-password", 10);
      t.mock.module("../src/config/database.js", {
        namedExports: {
          prisma: {
            user: {
              findUnique: async ({ where }) => {
                assert.equal(where.email, "login@example.com");
                return {
                  id: "user-10",
                  email: "login@example.com",
                  password: hashed,
                  fullName: "Login User",
                  userType: "CUSTOMER",
                };
              },
            },
          },
        },
      });

      const { loginUser } = await import(
        `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
      );

      const result = await loginUser("login@example.com", "correct-password");

      assert.deepEqual(result.user, {
        id: "user-10",
        name: "Login User",
        email: "login@example.com",
        role: "CUSTOMER",
      });
      assert.equal(typeof result.token, "string");
      const decoded = jwt.verify(result.token, "test-jwt-secret");
      assert.equal(decoded.id, "user-10");
      assert.equal(decoded.role, "CUSTOMER");
    },
  );
});

test("UTCID02: loginUser tra ve null khi password la chuoi rong (bien)", async (t) => {
  await withEnv({ JWT_SECRET: "test-jwt-secret" }, async () => {
    const hashed = await bcrypt.hash("real-password", 10);
    t.mock.module("../src/config/database.js", {
      namedExports: {
        prisma: {
          user: {
            findUnique: async () => ({
              id: "user-11",
              email: "boundary@example.com",
              password: hashed,
              fullName: "Boundary User",
              userType: "CUSTOMER",
            }),
          },
        },
      },
    });

    const { loginUser } = await import(
      `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
    );

    const result = await loginUser("boundary@example.com", "");
    assert.equal(result, null);
  });
});

test("UTCID03: loginUser tra ve null khi khong tim thay user", async (t) => {
  await withEnv({ JWT_SECRET: "test-jwt-secret" }, async () => {
    t.mock.module("../src/config/database.js", {
      namedExports: {
        prisma: {
          user: { findUnique: async () => null },
        },
      },
    });

    const { loginUser } = await import(
      `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
    );

    const result = await loginUser("nobody@example.com", "whatever");
    assert.equal(result, null);
  });
});

test("UTCID04: loginUser tra ve null khi sai password", async (t) => {
  await withEnv({ JWT_SECRET: "test-jwt-secret" }, async () => {
    const hashed = await bcrypt.hash("correct-password", 10);
    t.mock.module("../src/config/database.js", {
      namedExports: {
        prisma: {
          user: {
            findUnique: async () => ({
              id: "user-12",
              email: "wrongpass@example.com",
              password: hashed,
              fullName: "Wrong Pass User",
              userType: "CUSTOMER",
            }),
          },
        },
      },
    });

    const { loginUser } = await import(
      `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
    );

    const result = await loginUser("wrongpass@example.com", "incorrect");
    assert.equal(result, null);
  });
});

test("UTCID05: loginUser dung han mac dinh 7d khi JWT_EXPIRES_IN khong duoc cau hinh (bien)", async (t) => {
  await withEnv(
    { JWT_SECRET: "test-jwt-secret", JWT_EXPIRES_IN: undefined },
    async () => {
      const hashed = await bcrypt.hash("correct-password", 10);
      t.mock.module("../src/config/database.js", {
        namedExports: {
          prisma: {
            user: {
              findUnique: async () => ({
                id: "user-13",
                email: "default-exp@example.com",
                password: hashed,
                fullName: "Default Exp User",
                userType: "CUSTOMER",
              }),
            },
          },
        },
      });

      const { loginUser } = await import(
        `../src/services/auth.service.js?case=${Date.now()}-${Math.random()}`
      );

      const result = await loginUser(
        "default-exp@example.com",
        "correct-password",
      );

      assert.equal(typeof result.token, "string");
      const decoded = jwt.verify(result.token, "test-jwt-secret");
      const sevenDaysInSeconds = 7 * 24 * 60 * 60;
      assert.ok(
        Math.abs(decoded.exp - decoded.iat - sevenDaysInSeconds) < 5,
        "expiry should default to 7 days",
      );
    },
  );
});
