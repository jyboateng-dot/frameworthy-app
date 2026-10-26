import Foundation

@MainActor
final class AppState: ObservableObject {
    @Published private(set) var cart: [FrameConfiguration] = []

    var cartCount: Int { cart.count }
    var cartTotal: Decimal { cart.reduce(0) { $0 + $1.estimatedPrice } }

    func addToCart(_ configuration: FrameConfiguration) {
        cart.append(configuration)
    }

    func removeFromCart(at offsets: IndexSet) {
        cart.remove(atOffsets: offsets)
    }
}
