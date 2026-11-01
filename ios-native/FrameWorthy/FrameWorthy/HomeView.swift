import SwiftUI

struct HomeView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Frame your best moments.")
                            .font(.system(size: 36, weight: .bold, design: .serif))
                            .foregroundStyle(Color.frameworthyInk)
                        Text("Design a custom frame from your photo, then send it to FrameWorthy for a precise quote.")
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        Label("Made for your walls", systemImage: "house.and.flag")
                            .font(.headline)
                        Text("Choose a frame profile, dimensions, and mat treatment in a native design experience.")
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 20))

                    VStack(alignment: .leading, spacing: 12) {
                        Text("How it works")
                            .font(.title2.weight(.semibold))
                        StepRow(number: "1", title: "Choose a photo", detail: "Select an image from your photo library.")
                        StepRow(number: "2", title: "Design your frame", detail: "Pick the size, style, and mat.")
                        StepRow(number: "3", title: "Review your quote", detail: "Save the configuration in your cart.")
                    }
                }
                .padding(24)
            }
            .navigationTitle("FrameWorthy")
        }
    }
}

private struct StepRow: View {
    let number: String
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(number)
                .font(.headline)
                .foregroundStyle(.white)
                .frame(width: 28, height: 28)
                .background(Color.frameworthyGold, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(title).fontWeight(.semibold)
                Text(detail).font(.subheadline).foregroundStyle(.secondary)
            }
        }
    }
}
