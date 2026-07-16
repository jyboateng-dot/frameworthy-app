import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import CartPage from './pages/cart/CartPage';
import WishlistPage from './pages/wishlist/WishlistPage';
import LandingPage from './pages/LandingPage';
import CustomizeFramePage from './pages/framing/CustomizeFramePage';
import CheckoutPage from './pages/checkout/CheckoutPage';
import SuccessPage from './pages/SuccessPage';
import InspirationPage from './pages/InspirationPage';
import SizeGuidePage from './pages/SizeGuidePage';
import PrestigePaintingsPage from './pages/PrestigePaintingsPage';
import OriginalPaintingsPage from './pages/OriginalPaintingsPage';
import CanvasArtPage from './pages/CanvasArtPage';
import GlossyArtPage from './pages/GlossyArtPage';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import OrdersPage from './pages/OrdersPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import RefundPolicyPage from './pages/RefundPolicyPage';

// Contexts
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

import { FRAME_STYLES, FRAME_SIZES, WALL_TEXTURES, MAT_COLORS } from './data/constants';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import TesterGate from './components/gate/TesterGate';

// --- MAIN LAYOUT COMPONENT ---
// This component has access to Router hooks (useNavigate, etc.)
const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cartCount, setIsCartOpen } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // --- GLOBAL STATE LIFTED UP (For Checkout/Persistance across steps) ---
  // Ideally this should be in a specific "ProjectContext", but prop drilling is fine for this size refactor

  // FRAMING STATE
  const [uploadedImage, setUploadedImage] = useState(
    'https://images.unsplash.com/photo-1526045478516-99145907023c?auto=format&fit=crop&w=1600&q=80&sat=-20&con=-10'
  );
  const [productionImage, setProductionImage] = useState(null);
  const [selectedFrame, setSelectedFrame] = useState(() => FRAME_STYLES.find(f => f.id === 'frame-10512') || FRAME_STYLES[0]); // Black Contemporary default
  const [selectedSize, setSelectedSize] = useState(FRAME_SIZES[3]); // Large Portrait default
  const [selectedWall, setSelectedWall] = useState(WALL_TEXTURES[2]); // For visualizer persistence

  // HOISTED FRAMING CUSTOMIZATIONS
  const [orientation, setOrientation] = useState('portrait');
  const [matColor, setMatColor] = useState(MAT_COLORS[0]);
  const [matWidth, setMatWidth] = useState('narrow');
  const [glassType, setGlassType] = useState('standard');
  const [hardwareType, setHardwareType] = useState('wire');
  const [isPreset, setIsPreset] = useState(false);
  const [presetTitle, setPresetTitle] = useState('');
  const [presetDims, setPresetDims] = useState('');

  // NEW: HOISTED STATE FOR CHECKOUT AND ORDER RECEPTION
  const [activeLayout, setActiveLayout] = useState('single');
  const [collageImages, setCollageImages] = useState({});
  const [frameThickness, setFrameThickness] = useState('thin');

  // NOTE: Inspiration-selection state (location.state from a "Get This"
  // navigation) is applied by applyInspirationSelection inside
  // CustomizeFramePage — the single shared handler for every Inspiration
  // entry point. Don't re-add a location.state sync here; a second copy is
  // exactly what let the entry points drift apart before.

  // SHARED STATE
  const [productMode, setProductMode] = useState('frame');
  const [totalPrice, setTotalPrice] = useState(0);

  // Determine "currentStep" for Header visibility logic based on path
  const getCurrentStep = () => {
    const path = location.pathname;
    if (path === '/') return 'landing';
    if (path === '/success') return 'success';
    return 'other';
  };

  // Set returning user flag on mount
  React.useEffect(() => {
    // We set a small timeout or just set it immediately.
    // This marks the browser as "having visited" FrameWorthy.
    if (!localStorage.getItem('fw_returning_user')) {
      localStorage.setItem('fw_returning_user', 'true');
    }
  }, []);

  // Android's hardware/gesture back button exits the whole app by default
  // in a Capacitor WebView instead of navigating back through the app's own
  // history — without this it feels broken on the very first back-press.
  // No-op on web/iOS: the App plugin doesn't fire this event there.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => { listenerPromise.then(listener => listener.remove()); };
  }, [navigate]);

  return (
    <div className={`font-sans text-fw-text min-h-screen selection:bg-fw-gold selection:text-black bg-[#faf9f8]`}>
      {location.pathname !== '/login' && (
        <Header
          currentStep={getCurrentStep()}
          user={user}
          navigate={navigate}
          cartCount={cartCount}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
        />
      )}

      <Routes>
        <Route path="/" element={<LandingPage navigate={navigate} setSelectedFrame={setSelectedFrame} />} />

        {/* FRAMING ROUTES */}
        <Route path="/frame/customize" element={
          <CustomizeFramePage
            uploadedImage={uploadedImage}
            setUploadedImage={setUploadedImage}
            productionImage={productionImage}
            setProductionImage={setProductionImage}
            selectedFrame={selectedFrame}
            setSelectedFrame={setSelectedFrame}
            selectedSize={selectedSize}
            setSelectedSize={setSelectedSize}
            setTotalPrice={setTotalPrice}
            navigate={navigate}
            
            orientation={orientation}
            setOrientation={setOrientation}
            matColor={matColor}
            setMatColor={setMatColor}
            matWidth={matWidth}
            setMatWidth={setMatWidth}
            glassType={glassType}
            setGlassType={setGlassType}
            hardwareType={hardwareType}
            setHardwareType={setHardwareType}
            
            activeLayout={activeLayout}
            setActiveLayout={setActiveLayout}
            collageImages={collageImages}
            setCollageImages={setCollageImages}
            frameThickness={frameThickness}
            setFrameThickness={setFrameThickness}
            isPreset={isPreset}
            setIsPreset={setIsPreset}
            presetTitle={presetTitle}
            setPresetTitle={setPresetTitle}
            presetDims={presetDims}
            setPresetDims={setPresetDims}
          />
        } />

        {/* AUTH ROUTE */}
        <Route path="/auth" element={
          user ? <Navigate to="/" /> : <AuthPage navigate={navigate} />
        } />

        {/* ADMIN ROUTE */}
        <Route path="/admin" element={
          <AdminDashboard />
        } />

        {/* CUSTOMER ROUTE */}
        <Route path="/orders" element={<OrdersPage />} />

        <Route path="/cart" element={<CartPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />

        {/* SHARED ROUTES */}
        <Route path="/checkout" element={
          <CheckoutPage
            productMode={productMode}
            uploadedImage={uploadedImage}
            productionImage={productionImage}
            selectedFrame={selectedFrame}
            selectedSize={selectedSize}
            totalPrice={totalPrice}
            navigate={navigate}
            
            orientation={orientation}
            matColor={matColor}
            matWidth={matWidth}
            glassType={glassType}
            hardwareType={hardwareType}

            activeLayout={activeLayout}
            collageImages={collageImages}
            frameThickness={frameThickness}
            isPreset={isPreset}
            presetTitle={presetTitle}
            presetDims={presetDims}
          />
        } />

        <Route path="/success" element={
          <SuccessPage
            productMode={productMode}
            setProductMode={setProductMode}
            navigate={navigate}
          />
        } />

        <Route path="/inspiration" element={
          <InspirationPage
            setProductMode={setProductMode}
            setSelectedFrame={setSelectedFrame}
            setSelectedSize={setSelectedSize}
            setSelectedWall={setSelectedWall}
            navigate={navigate}
          />
        } />

        <Route path="/size-guide" element={
          <SizeGuidePage
            setSelectedSize={setSelectedSize}
            setProductMode={setProductMode}
            navigate={navigate}
          />
        } />

        <Route path="/terms" element={<TermsPage navigate={navigate} />} />
        <Route path="/privacy" element={<PrivacyPage navigate={navigate} />} />
        <Route path="/refund-policy" element={<RefundPolicyPage navigate={navigate} />} />

        <Route path="/original-paintings" element={
          <OriginalPaintingsPage
            setProductMode={setProductMode}
            setSelectedFrame={setSelectedFrame}
            setSelectedSize={setSelectedSize}
            navigate={navigate}
          />
        } />

        <Route path="/original-paintings-prestige" element={
          <PrestigePaintingsPage
            setProductMode={setProductMode}
            setSelectedFrame={setSelectedFrame}
            setSelectedSize={setSelectedSize}
            navigate={navigate}
          />
        } />

        <Route path="/canvas-art" element={
          <CanvasArtPage
            setProductMode={setProductMode}
            setSelectedFrame={setSelectedFrame}
            setSelectedSize={setSelectedSize}
            navigate={navigate}
          />
        } />

        <Route path="/glossy-art" element={
          <GlossyArtPage
            setProductMode={setProductMode}
            setSelectedFrame={setSelectedFrame}
            setSelectedSize={setSelectedSize}
            navigate={navigate}
          />
        } />

        <Route path="/login" element={<AuthPage navigate={navigate} />} />

        {/* Catch all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* GLOBAL OVERLAYS */}
    </div>
  );
};


import { UnitProvider } from './context/UnitContext';

const App = () => {
  return (
    <TesterGate>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <UnitProvider>
              <Router>
                <AppLayout />
              </Router>
            </UnitProvider>
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </TesterGate>
  );
};

export default App;
