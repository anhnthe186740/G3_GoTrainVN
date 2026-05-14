import { useForm } from "react-hook-form";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";

export function Login() {
  const { register, handleSubmit } = useForm();
  const onSubmit = () => {};

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Login</h1>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Email" type="email" {...register("email")} />
        <Input label="Password" type="password" {...register("password")} />
        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </Card>
  );
}
