import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
            <p className="text-sm text-gray-500 mt-1">
              Advoga — plataforma de estudos OAB
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
