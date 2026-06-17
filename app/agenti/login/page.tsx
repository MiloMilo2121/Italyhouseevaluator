import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div style={{ maxWidth: 360, margin: '0 auto' }}>
      <h1>Accesso agenti</h1>
      <p style={{ color: '#666', fontSize: 14 }}>Area riservata Delfino Real Estate.</p>
      <LoginForm />
    </div>
  );
}
