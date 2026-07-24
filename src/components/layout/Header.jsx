import React, { useState } from 'react';
import { User, ShoppingCart, Menu, ArrowLeft, LogOut, Package, ChevronDown, Shield, Frame } from 'lucide-react';
import { useAuth } from '../../context/AuthContext'; // Import Auth Context
import { useUnit } from '../../context/UnitContext'; // Import Unit Context
import { useCart } from '../../context/CartContext'; // Import Cart Context

// Mirrors AdminDashboard.jsx's own check — keep these in sync if the admin
// email ever changes.
const ADMIN_EMAIL = 'admin@frameworthyco.com';

const Header = ({
    currentStep,
    user, // This user prop comes from App.jsx's useAuth(), but we can also use useAuth() directly here if we want to be cleaner.
    navigate,
    isMenuOpen,
    setIsMenuOpen
}) => {
    const { logout } = useAuth(); // Get logout function
    const { cartCount, setIsCartOpen } = useCart(); // Get cart context
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

    const showBack = currentStep !== 'landing' && currentStep !== 'success';

    const handleLogout = () => {
        logout();
        setIsUserMenuOpen(false);
        navigate('/');
    };

    const handleFramesClick = () => {
        setIsMenuOpen(false);
        navigate('/');
        setTimeout(() => {
            const element = document.getElementById('curated-frames');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
            }
        }, 150);
    };

    return (
        <nav className="min-h-14 flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] bg-[#0a0a0a] border-b border-white/[0.07] sticky top-0 z-[100] backdrop-blur-sm">

            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                {showBack && (
                    <button onClick={() => navigate(-1)} className="text-[#9a8e7d] p-1 sm:p-1.5 hover:bg-white/[0.05] rounded-full transition mr-0.5 sm:mr-1 shrink-0" aria-label="Go back">
                        <ArrowLeft size={18} className="sm:w-5 sm:h-5" />
                    </button>
                )}

                <div className="flex items-center cursor-pointer gap-0.5 min-w-0" onClick={() => navigate('/')} title="Go to home">
                    {/* LOGO: Double Border Frame Version */}
                    <div className="w-7 h-7 sm:w-8 sm:h-8 border-4 border-double border-[#e8e2d9] rounded-[1px] flex items-center justify-center shrink-0">
                        <span className="text-base sm:text-xl font-serif font-bold text-[#e8e2d9] leading-none pb-1">Fr</span>
                    </div>

                    {/* Part 2: ameWorthy */}
                    <span className="text-base sm:text-xl font-serif font-bold tracking-tight text-[#e8e2d9] leading-none truncate">ameWorthy</span>
                </div>
            </div>


            <div className="flex items-center gap-2.5 sm:gap-3 lg:gap-6">

                {/* Desktop Nav Links */}
                <div className="hidden sm:flex items-center gap-2 md:gap-4 lg:gap-6 mr-0 lg:mr-2">
                    <button
                        onClick={handleFramesClick}
                        className="text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-[#9a8e7d] hover:text-[#e8e2d9] transition-colors whitespace-nowrap"
                    >
                        Frames
                    </button>
                    <button
                        onClick={() => navigate('/inspiration')}
                        className="text-[10px] lg:text-[11px] font-bold uppercase tracking-wider text-[#9a8e7d] hover:text-[#e8e2d9] transition-colors whitespace-nowrap"
                    >
                        Inspiration
                    </button>
                </div>

                {/* Standalone Entry Point — visible at every width; "Start Framing"
                    is too wide below md, so it collapses to a gold icon + "Start"
                    there (previously hidden below sm, which dropped the CTA
                    entirely on narrow/mobile screens instead of just shortening it). */}
                <button
                    onClick={() => navigate('/frame/customize')}
                    className="flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 md:px-4 py-1 sm:py-1.5 text-xs md:text-sm font-bold bg-[#c9a84c] text-[#0a0a0a] rounded-full hover:bg-[#d4b55c] transition-colors whitespace-nowrap shrink-0"
                >
                    <Frame size={13} className="md:hidden" />
                    <span className="md:hidden">Start</span>
                    <span className="hidden md:inline">Start Framing</span>
                </button>

                {/* User Menu */}
                {user ? (
                    <div
                        className="relative hidden sm:block"
                        onMouseEnter={() => setIsUserMenuOpen(true)}
                        onMouseLeave={() => setIsUserMenuOpen(false)}
                    >
                        <button
                            className="flex items-center gap-2 text-sm font-bold text-[#9a8e7d] hover:text-[#e8e2d9] transition px-1 md:px-2 py-1 rounded-lg hover:bg-white/[0.05]"
                        >
                            <div className="w-8 h-8 bg-white/[0.08] rounded-full flex items-center justify-center text-[#9a8e7d] shrink-0">
                                <User size={16} />
                            </div>
                            <span className="hidden lg:inline">{user.displayName?.split(' ')[0] || 'User'}</span>
                            <ChevronDown size={14} className={`hidden lg:inline text-[#5a5248] transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown */}
                        {isUserMenuOpen && (
                            <div className="absolute top-full right-0 mt-0 pt-2 w-48 z-50">
                                <div className="bg-[#141210] rounded-xl shadow-xl border border-white/[0.07] py-1 animate-fade-in-up">
                                    <div className="px-4 py-3 border-b border-white/[0.05] mb-1">
                                        <p className="text-xs text-[#5a5248] font-bold uppercase">Signed in as</p>
                                        <p className="text-sm font-medium text-[#e8e2d9] truncate">{user.email}</p>
                                    </div>
                                    <button 
                                        onClick={() => { navigate('/orders'); setIsUserMenuOpen(false); }}
                                        className="w-full text-left px-4 py-2 text-sm text-[#9a8e7d] hover:bg-white/[0.05] hover:text-[#e8e2d9] flex items-center gap-2 transition"
                                    >
                                        <Package size={16} /> My Orders
                                    </button>
                                    {user.email === ADMIN_EMAIL && (
                                        <button
                                            onClick={() => { navigate('/admin'); setIsUserMenuOpen(false); }}
                                            className="w-full text-left px-4 py-2 text-sm text-[#c9a84c] hover:bg-white/[0.05] flex items-center gap-2 transition"
                                        >
                                            <Shield size={16} /> Admin Dashboard
                                        </button>
                                    )}
                                    <div className="border-t border-white/[0.05] mt-1 pt-1">
                                        <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition">
                                            <LogOut size={16} /> Sign Out
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={() => navigate('/login')}
                        className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full text-[#9a8e7d] hover:text-[#c9a84c] hover:bg-white/[0.05] transition"
                        title="Sign In"
                    >
                        <User size={20} />
                    </button>
                )}


                <div className="relative shrink-0">
                    <button
                        onClick={() => navigate('/cart')}
                        className="text-[#9a8e7d] p-1.5 sm:p-2 hover:bg-white/[0.05] rounded-full transition"
                    >
                        <ShoppingCart size={20} className="sm:w-6 sm:h-6" />
                    </button>
                    {cartCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-[#c9a84c] text-[#0a0808] text-xs rounded-full h-4 w-4 flex items-center justify-center font-center font-bold">{cartCount}</span>
                    )}
                </div>
                <div
                    className="relative shrink-0"
                    onMouseEnter={() => setIsMenuOpen(true)}
                    onMouseLeave={() => setIsMenuOpen(false)}
                >
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-[#9a8e7d] p-1.5 sm:p-2 hover:bg-white/[0.05] rounded-full transition"
                    >
                        <Menu size={20} className="sm:w-6 sm:h-6" />
                    </button>

                    {/* Mobile Menu Overlay */}
                    {isMenuOpen && (
                        <div className="absolute top-full right-0 w-64 pt-2 z-50">
                            <div className="bg-[#141210]/95 backdrop-blur-md shadow-xl border border-white/[0.07] rounded-xl flex flex-col p-4 space-y-2 animate-fade-in-up">
                                <button onClick={() => { navigate('/'); setIsMenuOpen(false); }} className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition text-[#e8e2d9] font-bold">Home</button>
                                <button onClick={handleFramesClick} className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition text-[#e8e2d9]">Frames</button>
                                <button onClick={() => { navigate('/inspiration'); setIsMenuOpen(false); }} className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition text-[#e8e2d9]">Inspiration</button>
                                <button onClick={() => { navigate('/frame/customize'); setIsMenuOpen(false); }} className="text-center py-2 mt-1 rounded-full font-bold text-sm bg-[#c9a84c] text-[#0a0a0a] hover:bg-[#d4b55c] transition-colors">Start Framing</button>

                                {user ? (
                                    <>
                                        <div className="border-t border-white/[0.07] my-2"></div>
                                        <button 
                                            onClick={() => { navigate('/orders'); setIsMenuOpen(false); }}
                                            className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition flex items-center gap-2 text-[#e8e2d9]"
                                        >
                                            <Package size={16} /> My Orders
                                        </button>
                                        {user.email === ADMIN_EMAIL && (
                                            <button
                                                onClick={() => { navigate('/admin'); setIsMenuOpen(false); }}
                                                className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition flex items-center gap-2 text-[#c9a84c] font-bold"
                                            >
                                                <Shield size={16} /> Admin Dashboard
                                            </button>
                                        )}
                                        <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition text-red-400 flex items-center gap-2"><LogOut size={16} /> Sign Out</button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { navigate('/login'); setIsMenuOpen(false); }} className="text-left py-2 hover:bg-white/[0.05] rounded px-2 transition font-bold text-[#c9a84c]">Sign In</button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Header;
