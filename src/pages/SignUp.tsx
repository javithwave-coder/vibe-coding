import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { UserPlus, Eye, EyeOff, Briefcase, Users } from 'lucide-react';

type EmploymentType = 'fulltime' | 'freelancer';

export const SignUp: React.FC = () => {
    const navigate = useNavigate();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [role, setRole] = useState<EmploymentType>('fulltime');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { data, error: signUpErr } = await supabase.auth.signUp({
                email,
                password,
            });

            if (signUpErr) throw signUpErr;

            if (data.user) {
                const { error: profileErr } = await supabase.from('profiles').insert([{
                    id: data.user.id,
                    email,
                    full_name: fullName,
                    role,
                    phone,
                    bio,
                    is_admin: false,
                }]);

                if (profileErr) throw profileErr;
            }

            navigate('/');
        } catch (err: any) {
            setError(err.message || 'An error occurred during sign up');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
            </div>

            <div className="w-full max-w-md relative z-10 animate-slide-up">
                {/* Brand */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-gradient mb-2">WLM Manager</h1>
                    <p className="text-text-muted text-sm">Join the WLM Sri Lanka team</p>
                </div>

                <Card>
                    <CardContent className="p-8">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-brand flex items-center justify-center mx-auto mb-4">
                                <UserPlus className="w-6 h-6 text-white" />
                            </div>
                            <h2 className="text-xl font-bold text-text-primary">Create Account</h2>
                        </div>

                        <form onSubmit={handleSignUp} className="space-y-4">
                            <Input
                                label="Full Name"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />

                            <Input
                                label="Email"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />

                            <div className="relative">
                                <Input
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Min. 6 characters"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-[34px] text-text-muted hover:text-text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            <Input
                                label="Phone Number"
                                type="tel"
                                placeholder="+94 77 XXX XXXX"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                            />

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                                    Job Role
                                </label>
                                <textarea
                                    className="flex w-full rounded-xl border border-border-default bg-white/[0.03] px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40 focus:border-accent-primary/50 transition-all duration-200 min-h-[80px] resize-none"
                                    placeholder="e.g. Senior Photographer, Editor"
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                />
                            </div>

                            {/* Role Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">
                                    Employment Type
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole('fulltime')}
                                        className={`
                                            flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
                                            ${role === 'fulltime'
                                                ? 'border-accent-primary/50 bg-gradient-brand-subtle glow-sm'
                                                : 'border-border-default bg-transparent hover:bg-surface-hover hover:border-border-hover'}
                                        `}
                                    >
                                        <Briefcase className={`w-5 h-5 ${role === 'fulltime' ? 'text-accent-primary' : 'text-text-muted'}`} />
                                        <span className={`text-sm font-medium ${role === 'fulltime' ? 'text-accent-primary' : 'text-text-secondary'}`}>
                                            Full-Time
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('freelancer')}
                                        className={`
                                            flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200
                                            ${role === 'freelancer'
                                                ? 'border-accent-primary/50 bg-gradient-brand-subtle glow-sm'
                                                : 'border-border-default bg-transparent hover:bg-surface-hover hover:border-border-hover'}
                                        `}
                                    >
                                        <Users className={`w-5 h-5 ${role === 'freelancer' ? 'text-accent-primary' : 'text-text-muted'}`} />
                                        <span className={`text-sm font-medium ${role === 'freelancer' ? 'text-accent-primary' : 'text-text-secondary'}`}>
                                            Freelancer
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-slide-down">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                isLoading={loading}
                            >
                                Create Account
                            </Button>
                        </form>

                        <p className="text-center text-sm text-text-muted mt-6">
                            Already have an account?{' '}
                            <Link to="/login" className="text-accent-primary hover:text-accent-secondary font-medium transition-colors">
                                Sign In
                            </Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
