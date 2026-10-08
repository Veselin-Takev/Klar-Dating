import { useNavigate } from 'react-router';
import { ForgotPasswordForm } from '../core/auth/ForgotPasswordForm';

export default function ForgotPasswordScreen() {
  const navigate = useNavigate();

  return (
    <ForgotPasswordForm
      onBackToLogin={() => navigate('/login', { replace: true })}
    />
  );
}
