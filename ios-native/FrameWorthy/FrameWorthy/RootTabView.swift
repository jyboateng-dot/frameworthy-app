import SwiftUI

struct RootTabView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        TabView {
            HomeView()
                .tabItem { Label("Discover", systemImage: "sparkles") }

            FrameCreatorView()
                .tabItem { Label("Create", systemImage: "square.on.square.dashed") }

            CartView()
                .tabItem {
                    Label("Cart", systemImage: "bag")
                }
                .badge(appState.cartCount)
        }
        .tint(.frameworthyGold)
    }
}

extension Color {
    static let frameworthyGold = Color(red: 0.74, green: 0.55, blue: 0.18)
    static let frameworthyInk = Color(red: 0.08, green: 0.07, blue: 0.06)
}
