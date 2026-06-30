import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Advoga — plataforma de estudos OAB
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
