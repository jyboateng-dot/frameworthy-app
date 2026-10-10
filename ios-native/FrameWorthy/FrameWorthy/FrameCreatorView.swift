import PhotosUI
import SwiftUI

struct FrameCreatorView: View {
    @EnvironmentObject private var appState: AppState
    @State private var photoItem: PhotosPickerItem?
    @State private var previewImage: Image?
    @State private var imageTitle = "Your artwork"
    @State private var selectedStyle: FrameStyle = .black
    @State private var selectedSize: FrameSize = .medium
    @State private var hasMat = true
    @State private var showingAddedConfirmation = false

    private var estimate: Decimal {
        FrameConfiguration(title: imageTitle, style: selectedStyle, size: selectedSize, hasMat: hasMat).estimatedPrice
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Artwork") {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Choose photo", systemImage: "photo.on.rectangle")
                    }
                    .onChange(of: photoItem) { _, newValue in
                        loadPreview(from: newValue)
                    }

                    if let previewImage {
                        previewImage
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 220)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    TextField("Artwork title", text: $imageTitle)
                }

                Section("Frame") {
                    Picker("Style", selection: $selectedStyle) {
                        ForEach(FrameStyle.allCases) { style in
                            Text(style.rawValue).tag(style)
                        }
                    }

                    Picker("Size", selection: $selectedSize) {
                        ForEach(FrameSize.allCases) { size in
                            Text(size.rawValue).tag(size)
                        }
                    }

                    Toggle("Add archival mat", isOn: $hasMat)
                }

                Section("Estimated price") {
                    LabeledContent("Configuration", value: selectedSize.rawValue)
                    LabeledContent("Estimate", value: estimate.formatted(.currency(code: "USD")))
                    Text("Final pricing is confirmed by the FrameWorthy team after reviewing your artwork and delivery details.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button {
                        appState.addToCart(
                            FrameConfiguration(
                                title: imageTitle.isEmpty ? "Your artwork" : imageTitle,
                                style: selectedStyle,
                                size: selectedSize,
                                hasMat: hasMat
                            )
                        )
                        showingAddedConfirmation = true
                    } label: {
                        Label("Add configuration to cart", systemImage: "bag.badge.plus")
                    }
                    .tint(.frameworthyGold)
                }
            }
            .navigationTitle("Create a Frame")
            .alert("Added to cart", isPresented: $showingAddedConfirmation) {
                Button("Continue designing", role: .cancel) {}
            } message: {
                Text("Your frame configuration is ready to review.")
            }
        }
    }

    private func loadPreview(from item: PhotosPickerItem?) {
        Task {
            guard let data = try? await item?.loadTransferable(type: Data.self),
                  let uiImage = UIImage(data: data) else { return }
            previewImage = Image(uiImage: uiImage)
        }
    }
}
