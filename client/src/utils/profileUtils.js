/**
 * Calculates profile completeness status for a user object.
 * @param {Object} user
 * @param {String} language 'vi' | 'en'
 * @returns {Object} { percentage, isComplete, missingFields, filledFields, totalFields, missingCount }
 */
export function calculateProfileCompleteness(user, language = "vi") {
  if (!user) {
    return {
      percentage: 0,
      isComplete: false,
      missingFields: [],
      filledFields: [],
      totalFields: 7,
      missingCount: 7,
    };
  }

  const fieldsConfig = [
    {
      key: "fullName",
      weight: 15,
      labelVi: "Họ và tên",
      labelEn: "Full Name",
      isFilled: (u) => Boolean(u.fullName || u.name),
    },
    {
      key: "phoneNumber",
      weight: 15,
      labelVi: "Số điện thoại",
      labelEn: "Phone Number",
      isFilled: (u) => Boolean(u.phoneNumber || u.phone),
    },
    {
      key: "nationalId",
      weight: 20,
      labelVi: "Số CCCD / Hộ chiếu",
      labelEn: "National ID / Passport",
      isFilled: (u) => Boolean(u.nationalId),
    },
    {
      key: "dateOfBirth",
      weight: 15,
      labelVi: "Ngày sinh",
      labelEn: "Date of Birth",
      isFilled: (u) => Boolean(u.dateOfBirth),
    },
    {
      key: "gender",
      weight: 10,
      labelVi: "Giới tính",
      labelEn: "Gender",
      isFilled: (u) => Boolean(u.gender),
    },
    {
      key: "address",
      weight: 15,
      labelVi: "Địa chỉ liên hệ",
      labelEn: "Address",
      isFilled: (u) => Boolean(u.address),
    },
    {
      key: "bankInfo",
      weight: 10,
      labelVi: "Tài khoản ngân hàng",
      labelEn: "Bank Account Details",
      isFilled: (u) => Boolean(u.bankAccount && u.bankName),
    },
  ];

  let percentage = 0;
  const missingFields = [];
  const filledFields = [];

  fieldsConfig.forEach((field) => {
    if (field.isFilled(user)) {
      percentage += field.weight;
      filledFields.push({
        key: field.key,
        label: language === "vi" ? field.labelVi : field.labelEn,
      });
    } else {
      missingFields.push({
        key: field.key,
        label: language === "vi" ? field.labelVi : field.labelEn,
      });
    }
  });

  percentage = Math.min(100, Math.round(percentage));
  const isComplete = percentage === 100;

  return {
    percentage,
    isComplete,
    missingFields,
    filledFields,
    totalFields: fieldsConfig.length,
    missingCount: missingFields.length,
  };
}
