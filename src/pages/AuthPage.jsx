import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';
import Wordmark from '../components/common/Wordmark';

const CAROUSEL_SLIDES = [
    { 
        img: '/hero_hanging_frame.jpg',
        title: "Welcome to FrameWorthy",
        text: "Transform your cherished memories and favorite artworks into stunning, gallery-quality centerpieces that elevate any space."
    },
    { 
        img: '/landing_carousel/slide-1.jpg',
        title: "Upload from Anywhere",
        text: "Upload pictures and images directly from your devices."
    },
    {
        img: '/hallway_banner.jpg',
        title: "Curate Your Hallways",
        text: "Turn your empty corridors into a beautiful walking gallery of your life's greatest moments and art."
    },
    {
        img: '/landing_carousel/album-cover.jpg',
        title: "Frame Your Favorite Album Covers",
        text: "Search for your favorite artist and easily frame their iconic album covers."
    },
    {
        img: '/landing_carousel/slide-3.jpg',
        title: "Endless Possibilities",
        text: "Choose from over 300 different premium frame styles."
    },
    {
        img: '/living_room_banner.jpg',
        title: "Elevate Your Living Space",
        text: "Create a stunning focal point in your living room with our premium, handcrafted frames."
    },
    { 
        img: '/landing_carousel/slide-4.jpg',
        title: "Perfectly Sized",
        text: "Choose the exact frame size to perfectly fit your space and your pictures."
    },
    { 
        img: '/landing_carousel/slide-5.jpg',
        title: "Curated Collections",
        text: "Access beautifully pre-framed images and curated artwork to inspire your space."
    },
    { 
        img: '/landing_carousel/slide-6.jpg',
        title: "Masterpieces at Home",
        text: "Directly search, browse, and custom-frame open-access public domain masterpieces from the Metropolitan Museum of Art."
    },
    { 
        img: '/landing_carousel/slide-7.jpg',
        title: "Delivered to Your Door",
        text: "We handcraft your custom frame and deliver it securely to your doorstep."
    },
    {
        img: '/hero_slide_6.jpg',
        title: "Create Your Gallery",
        text: "Curate a personalized gallery wall with your favorite art and memories."
    },
    {
        img: '/landing_carousel/slide-9.jpg',
        title: "Showcase the Best",
        text: "Display your most cherished moments in stunning large format."
    }
];

const AuthPage = ({ navigate }) => {
    const { login, signup, googleLogin, appleLogin, resetPassword, redirectReturnTo, clearRedirectReturnTo } = useAuth();
    const location = useLocation();

    // Determine initial mode based on URL query param
    const [isLogin, setIsLogin] = useState(true);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const mode = params.get('mode');
        if (mode === 'signup') {
            setIsLogin(false);
        }
    }, [location]);

    // Where to send the user after a successful sign-in/sign-up — AuthModal
    // (shown from cart/customize guest-checkout) passes ?returnTo=/checkout
    // so they land back where they were instead of the homepage.
    const returnTo = new URLSearchParams(location.search).get('returnTo') || '/';

    // On native (Capacitor), Google sign-in goes through signInWithRedirect
    // instead of a popup (see AuthContext), which reloads the whole app —
    // this picks up the result once AuthContext's redirect-result effect
    // resolves, since the handleSocialLogin call below never gets to finish
    // its own await after a real page navigation away.
    useEffect(() => {
        if (redirectReturnTo && navigate) {
            navigate(redirectReturnTo);
            clearRedirectReturnTo();
        }
    }, [redirectReturnTo, navigate, clearRedirectReturnTo]);

    // Auto-advance carousel
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % CAROUSEL_SLIDES.length);
        }, 6000);
        return () => clearInterval(timer);
    }, []);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [resetStatus, setResetStatus] = useState(null); // { type: 'success' | 'error', message }

    const handleSocialLogin = async (provider) => {
        setIsLoading(true);
        setErrors({});
        try {
            if (provider === 'google') {
                await googleLogin(returnTo);
            } else if (provider === 'apple') {
                await appleLogin(returnTo);
            }
            // On native Android/web, signInWithRedirect or the native Apple
            // sheet either navigates the whole app away (redirectReturnTo
            // effect above handles that case) or resolves right here (native
            // iOS Apple sign-in) — either way this line is only reached once
            // there's actually a signed-in user to send onward.
            if (navigate) navigate(returnTo);
        } catch (err) {
            console.error(err);
            setErrors({ form: err.message || 'Authentication failed' });
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        setResetStatus(null);
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            setResetStatus({ type: 'error', message: 'Enter your email address above first.' });
            return;
        }
        try {
            await resetPassword(formData.email);
            setResetStatus({ type: 'success', message: `Password reset email sent to ${formData.email}.` });
        } catch (err) {
            console.error(err);
            setResetStatus({ type: 'error', message: 'Could not send reset email. Please try again.' });
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email format';

        if (!formData.password) newErrors.password = 'Password is required';
        else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';

        if (!isLogin && !formData.name) newErrors.name = 'Name is required';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validate()) {
            setIsLoading(true);
            setErrors({});
            try {
                if (isLogin) {
                    await login(formData.email, formData.password, rememberMe);
                } else {
                    await signup(formData.name, formData.email, formData.password);
                }
                if (navigate) navigate(returnTo);
            } catch (err) {
                console.error(err);
                // Simplify Firebase error messages
                let msg = 'Authentication failed';
                if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                    msg = 'Invalid email or password';
                } else if (err.code === 'auth/email-already-in-use') {
                    // Deliberately not "Email already in use" — that confirms
                    // to whoever's typing that this exact address has an
                    // account, the same enumeration risk the login path
                    // already avoids by collapsing its errors into one
                    // generic message. This softens the client-side signal;
                    // it can't fully close the leak, since Firebase Auth's
                    // own REST API returns a distinct EMAIL_EXISTS code
                    // regardless of what this app's UI shows.
                    msg = "Couldn't create your account with that email. If you already have one, try signing in instead.";
                }
                setErrors({ form: msg });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen relative z-50 flex animate-fade-in bg-stone-900 overflow-x-hidden">
            {/* Full-Screen Background Carousel */}
            <div className="fixed inset-0 z-0">
                {CAROUSEL_SLIDES.map((slide, idx) => (
                    <div
                        key={idx}
                        className={`absolute inset-0 transition-opacity duration-1000 ${
                            currentSlide === idx ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                    >
                        <div
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url("${slide.img}")` }}
                        ></div>
                        {/* Elegant gradient overlays */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-black/40"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent lg:hidden"></div>
                    </div>
                ))}
            </div>

            {/* Content Container */}
            <div className="relative z-10 w-full flex flex-col lg:flex-row min-h-screen">
                {/* Left Side - Narrative (Visible on LG) */}
                <div className="hidden lg:flex w-1/2 p-12 xl:p-16 flex-col justify-between text-[#e8e2d9]">
                    {/* Logo */}
                    <div className="cursor-pointer group" onClick={() => navigate('/')}>
                        <Wordmark
                            size={20}
                            ink="#e8e2d9"
                            markClassName="group-hover:scale-105 transition-transform drop-shadow-md"
                            textClassName="text-xl drop-shadow-md"
                        />
                    </div>

                    {/* Narrative Text & Pagination */}
                    <div className="mb-12">
                        <h2 className="text-4xl xl:text-5xl font-serif font-bold mb-4 drop-shadow-lg leading-tight">
                            {CAROUSEL_SLIDES[currentSlide].title}
                        </h2>
                        <p className="text-xl font-medium text-white/90 drop-shadow max-w-md">
                            {CAROUSEL_SLIDES[currentSlide].text}
                        </p>
                        
                        <div className="flex gap-2 mt-10 overflow-x-auto hide-scrollbar">
                            {CAROUSEL_SLIDES.map((_, dotIdx) => (
                                <button
                                    key={dotIdx}
                                    onClick={() => setCurrentSlide(dotIdx)}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${
                                        currentSlide === dotIdx ? 'w-10 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'w-2 bg-white/40 hover:bg-white/60'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Mobile Header (Hidden on LG) */}
                <div className="lg:hidden p-6 flex justify-between items-center w-full">
                    <div onClick={() => navigate('/')}>
                        <Wordmark size={18} ink="#ffffff" markClassName="drop-shadow-md" textClassName="text-lg drop-shadow-md" />
                    </div>
                    <button onClick={() => navigate('/')} className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 transition">
                        <X size={20} />
                    </button>
                </div>

                {/* Right Side - Glass Form Card */}
                <div className="w-full lg:w-1/2 flex-1 flex items-center justify-center p-4 sm:p-8">
                    <div className="w-full max-w-md bg-white/60 dark:bg-black/40 backdrop-blur-2xl border border-white/50 dark:border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.2)] rounded-[2rem] p-8 relative">
                        {/* Close Button (LG only, mobile uses header) */}
                        <button onClick={() => navigate('/')} className="hidden lg:flex absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 transition">
                            <X size={20} className="text-stone-700" />
                        </button>

                        <div className="text-center mb-8">
                            <h3 className="text-2xl font-serif font-bold text-stone-900 mb-2">
                                {isLogin ? 'Welcome to FrameWorthy' : 'Join FrameWorthy'}
                            </h3>
                            <p className="text-stone-600 text-sm">
                                {isLogin ? 'Sign in to access your saved frames and orders.' : 'Create an account to start your gallery wall.'}
                            </p>
                        </div>
                        
                        {/* Auth Tabs */}
                        <div className="flex bg-black/5 backdrop-blur-md p-1 rounded-xl mb-8 border border-white/40 shadow-inner">
                            <button 
                                onClick={() => { setIsLogin(true); setErrors({}); }}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                    isLogin ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                Sign In
                            </button>
                            <button 
                                onClick={() => { setIsLogin(false); setErrors({}); }}
                                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                                    !isLogin ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                Create Account
                            </button>
                        </div>

                        {/* Social Logins — requires the "Apple" provider enabled in Firebase Console
                            (Authentication > Sign-in method), configured with a Services ID, Apple
                            Team ID, Key ID, and private key from a Sign In with Apple key (separate
                            from the App Store Connect API key used for Codemagic signing) */}
                        <div className="mb-6">
                            <button
                                onClick={() => handleSocialLogin('google')}
                                className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/60 bg-white/70 hover:bg-white/90 transition font-bold text-sm text-stone-700 shadow-sm rounded-xl"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Continue with Google
                            </button>
                            <button
                                onClick={() => handleSocialLogin('apple')}
                                className="w-full flex items-center justify-center gap-2 py-2.5 mt-2.5 bg-black hover:bg-stone-900 transition font-bold text-sm text-white shadow-sm rounded-xl"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16.365 1.43c0 1.14-.463 2.147-1.15 2.87-.774.83-2.033 1.474-3.06 1.393-.13-1.1.4-2.234 1.135-2.965.79-.792 2.113-1.362 3.075-1.298zm2.792 16.735c-.585 1.26-.85 1.822-1.593 2.94-1.036 1.56-2.5 3.51-4.312 3.526-1.61.017-2.02-1.045-4.2-1.033-2.18.012-2.633 1.05-4.243 1.033-1.812-.016-3.194-1.77-4.23-3.33C-2.16 17.63-1.14 12.14 1.36 9.65c1.24-1.244 2.86-1.98 4.37-1.98 1.63 0 2.65 1.06 4 1.06 1.31 0 2.1-1.06 4-1.06 1.34 0 2.76.73 3.77 1.99-3.31 1.813-2.78 6.53.65 8.51-.31.716-.65 1.34-1 1.98z" />
                                </svg>
                                Continue with Apple
                            </button>
                        </div>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-stone-300/50"></div>
                            </div>
                            <div className="relative flex justify-center text-xs">
                                <span className="px-3 bg-transparent text-stone-500 uppercase tracking-widest font-bold">Or</span>
                            </div>
                        </div>

                        {errors.form && (
                            <div className="mb-5 p-3 bg-red-50/90 backdrop-blur-md text-red-600 text-sm font-medium rounded-xl border border-red-200 shadow-sm">
                                {errors.form}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {!isLogin && (
                                <div className="space-y-1">
                                    <div className="relative">
                                        <User className="absolute left-4 top-3 text-stone-400" size={18} />
                                        <label htmlFor="auth-name" className="sr-only">Full Name</label>
                                        <input
                                            id="auth-name"
                                            type="text"
                                            placeholder="Full Name"
                                            className={`w-full pl-12 pr-4 py-3 rounded-xl border bg-white/70 backdrop-blur-sm text-stone-900 placeholder:text-stone-500 ${
                                                errors.name ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-white/50 focus:border-stone-400 focus:ring-stone-400'
                                            } focus:ring-1 outline-none transition shadow-inner`}
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    {errors.name && <p className="text-xs text-red-500 ml-2 font-medium">{errors.name}</p>}
                                </div>
                            )}

                            <div className="space-y-1">
                                <div className="relative">
                                    <Mail className="absolute left-4 top-3 text-stone-400" size={18} />
                                    <label htmlFor="auth-email" className="sr-only">Email Address</label>
                                    <input
                                        id="auth-email"
                                        type="email"
                                        placeholder="Email Address"
                                        className={`w-full pl-12 pr-4 py-3 rounded-xl border bg-white/70 backdrop-blur-sm text-stone-900 placeholder:text-stone-500 ${
                                            errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-white/50 focus:border-stone-400 focus:ring-stone-400'
                                        } focus:ring-1 outline-none transition shadow-inner`}
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                {errors.email && <p className="text-xs text-red-500 ml-2 font-medium">{errors.email}</p>}
                            </div>

                            <div className="space-y-1">
                                <div className="relative">
                                    <Lock className="absolute left-4 top-3 text-stone-400" size={18} />
                                    <label htmlFor="auth-password" className="sr-only">Password</label>
                                    <input
                                        id="auth-password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        className={`w-full pl-12 pr-12 py-3 rounded-xl border bg-white/70 backdrop-blur-sm text-stone-900 placeholder:text-stone-500 ${
                                            errors.password ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-white/50 focus:border-stone-400 focus:ring-stone-400'
                                        } focus:ring-1 outline-none transition shadow-inner`}
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-3 text-stone-400 hover:text-stone-600 focus:outline-none"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {errors.password && <p className="text-xs text-red-500 ml-2 font-medium">{errors.password}</p>}
                            </div>

                            {isLogin && (
                                <div className="flex justify-between items-center pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <div className="relative flex items-center">
                                            <input 
                                                type="checkbox" 
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 transition-colors cursor-pointer" 
                                            />
                                        </div>
                                        <span className="text-xs font-medium text-stone-600 group-hover:text-stone-900 transition-colors">Remember me</span>
                                    </label>
                                    <button type="button" onClick={handleForgotPassword} className="text-xs text-stone-600 hover:text-stone-900 font-bold transition-colors">Forgot Password?</button>
                                </div>
                            )}

                            {resetStatus && (
                                <div className={`p-3 text-sm font-medium rounded-xl border shadow-sm backdrop-blur-md ${
                                    resetStatus.type === 'success'
                                        ? 'bg-emerald-50/90 text-emerald-700 border-emerald-200'
                                        : 'bg-red-50/90 text-red-600 border-red-200'
                                }`}>
                                    {resetStatus.message}
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-[#c9a84c] text-[#0a0a0a] hover:bg-[#d4b55c] py-3.5 rounded-xl font-bold font-serif text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_20px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                                    {!isLoading && <ArrowRight size={18} />}
                                </button>
                            </div>
                        </form>

                        {!isLogin && (
                            <div className="mt-6 text-center">
                                <p className="text-xs text-stone-600">By creating an account, you agree to our <button type="button" onClick={() => navigate('/terms')} className="font-bold underline hover:text-stone-900 transition">Terms</button> & <button type="button" onClick={() => navigate('/privacy')} className="font-bold underline hover:text-stone-900 transition">Privacy Policy</button>.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
