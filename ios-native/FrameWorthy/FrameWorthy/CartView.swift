import SwiftUI

struct CartView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            Group {
                if appState.cart.isEmpty {
                    ContentUnavailableView(
                        "Your cart is empty",
                        systemImage: "bag",
                        description: Text("Create a frame configuration to start your quote.")
                    )
                } else {
                    List {
                        ForEach(appState.cart) { item in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(item.title).font(.headline)
                                Text("\(item.style.rawValue) · \(item.size.rawValue)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Text(item.estimatedPrice.formatted(.currency(code: "USD")))
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Color.frameworthyGold)
                            }
                            .padding(.vertical, 4)
                        }
                        .onDelete(perform: appState.removeFromCart)

                        LabeledContent("Estimated total", value: appState.cartTotal.formatted(.currency(code: "USD")))
                            .font(.headline)
                    }
                }
            }
            .navigationTitle("Your Cart")
        }
    }
}
