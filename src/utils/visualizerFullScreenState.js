// Shared mutable flag letting App.jsx's single Android hardware-back-button
// handler close the full-screen visualizer instead of navigating back a
// page. Capacitor's App plugin has no stopPropagation-style mechanism
// between multiple 'backButton' listeners, so a second competing listener
// in CustomizeFramePage risked both firing on one press (closing full
// screen AND navigating back). This plain object is set/cleared by
// CustomizeFramePage as it enters/exits full screen, and read by App.jsx.
export const visualizerFullScreenState = {
    isActive: false,
    close: null,
};
