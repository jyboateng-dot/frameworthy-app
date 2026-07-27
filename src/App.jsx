import React, { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import LandingPage from './pages/LandingPage';

// Lazy-loaded: none of these need to be in the initial bundle everyone
// downloads just to see the homepage. Inspiration in particular pulls in
// several MB of catalogue data (Met Museum, album covers, movie posters)
// that should only load when someone actually visits it.
const CartPage = lazy(() => import('./pages/cart/CartPage'));
const WishlistPage = lazy(() => import('./pages/wishlist/WishlistPage'));
const CustomizeFramePage = lazy(() => import('./pages/framing/CustomizeFramePage'));
const CheckoutPage = lazy(() => import('./pages/checkout/CheckoutPage'));
const SuccessPage = lazy(() => import('./pages/SuccessPage'));
const InspirationPage = lazy(() => import('./pages/InspirationPage'));
// SizeGuidePage stashed for now — route/import removed below, file left on disk.
const PrestigePaintingsPage = lazy(() => import('./pages/PrestigePaintingsPage'));
const OriginalPaintingsPage = lazy(() => import('./pages/OriginalPaintingsPage'));
const CanvasArtPage = lazy(() => import('./pages/CanvasArtPage'));
const GlossyArtPage = lazy(() => import('./pages/GlossyArtPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminMessagesPage = lazy(() => import('./pages/admin/AdminMessagesPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const RefundPolicyPage = lazy(() => import('./pages/RefundPolicyPage'));
const DeliveryPolicyPage = lazy(() => import('./pages/DeliveryPolicyPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));

// Contexts
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

import { FRAME_STYLES, FRAME_SIZES, WALL_TEXTURES, MAT_COLORS, DEFAULT_DEMO_IMAGE } from './data/constants';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { enableNetwork } from 'firebase/firestore';
import { db } from './services/firebase';
import TesterGate from './components/gate/TesterGate';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import ChatFloater from './components/chat/ChatFloater';
import { visualizerFullScreenState } from './utils/visualizerFullScreenState';

// Shown briefly while a lazy-loaded route's chunk downloads — most routes
// are cached after the first visit, so this is typically only seen once
// per route per session, if at all on a fast connection.
const RouteLoadingFallback = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-stone-200 border-t-[#c9a84c] rounded-full animate-spin" />
  </div>
);

// --- MAIN LAYOUT COMPONENT ---
// This component has access to Router hooks (useNavigate, etc.)
const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { cartCount, setIsCartOpen } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Scroll to top on route change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // --- GLOBAL STATE LIFTED UP (For Checkout/Persistance across steps) ---
  // Ideally this should be in a specific "ProjectContext", but prop drilling is fine for this size refactor

  // FRAMING STATE
  const [uploadedImage, setUploadedImage] = useState(DEFAULT_DEMO_IMAGE);
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
      if (visualizerFullScreenState.isActive && visualizerFullScreenState.close) {
        visualizerFullScreenState.close();
        return;
      }
      if (canGoBack) {
        navigate(-1);
      } else {
        CapacitorApp.exitApp();
      }
    });
    return () => { listenerPromise.then(listener => listener.remove()); };
  }, [navigate]);

  // Firestore's realtime listeners (chat messages, the admin unread-message
  // badge) stream over a connection that iOS/Android can silently suspend
  // while the app is backgrounded. Firestore does reconnect on its own, but
  // its retry backoff can leave chat looking stale for a few seconds after
  // returning to the app. enableNetwork() is a safe no-op if already
  // connected, but forces an immediate reconnect attempt on resume instead
  // of waiting on that backoff. No-op on web: nothing suspends the
  // connection there, and the App plugin doesn't fire this event anyway.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        enableNetwork(db).catch(() => {});
      }
    });
    return () => { listenerPromise.then(listener => listener.remove()); };
  }, []);

  // Match the status bar to the app's always-dark header (#0a0a0a) instead
  // of leaving it at the OS default light style with dark, hard-to-read
  // icons/text. Doesn't touch overlay behavior — the existing
  // safe-area-inset-top padding in Header.jsx already accounts for that.
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    if (Capacitor.getPlatform() === 'android') {
      StatusBar.setBackgroundColor({ color: '#0a0a0a' }).catch(() => {});
    }
  }, []);

  return (
    <div className={`font-sans text-fw-text min-h-screen selection:bg-fw-gold selection:text-black bg-[#faf9f8]`}>
      <NetworkStatusBanner />
      {location.pathname !== '/login' && (
        <Header
          currentStep={getCurrentStep()}
          user={user}
          navigate={navigate}
          cartCount={cartCount}
          isMenuOpen={isMenuOpen}
          setIsMenuOpen={setIsMenuOpen}
          onOpenChat={() => setIsChatOpen(true)}
        />
      )}

      <Suspense fallback={<RouteLoadingFallback />}>
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
        <Route path="/admin/messages" element={
          <AdminMessagesPage />
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

        <Route path="/terms" element={<TermsPage navigate={navigate} />} />
        <Route path="/privacy" element={<PrivacyPage navigate={navigate} />} />
        <Route path="/refund-policy" element={<RefundPolicyPage navigate={navigate} />} />
        <Route path="/delivery-policy" element={<DeliveryPolicyPage navigate={navigate} />} />
        <Route path="/help" element={<HelpCenterPage navigate={navigate} onOpenChat={() => setIsChatOpen(true)} />} />

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
      </Suspense>

      {/* GLOBAL OVERLAYS */}
      <ChatFloater isOpen={isChatOpen} setIsOpen={setIsChatOpen} />
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
