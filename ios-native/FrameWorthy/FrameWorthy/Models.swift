import Foundation

enum FrameStyle: String, CaseIterable, Identifiable {
    case black = "Flat Black"
    case walnut = "Warm Walnut"
    case gold = "Gallery Gold"
    case oak = "Natural Oak"

    var id: String { rawValue }

    var priceAdjustment: Decimal {
        switch self {
        case .black: 0
        case .walnut: 18
        case .gold: 28
        case .oak: 22
        }
    }
}

enum FrameSize: String, CaseIterable, Identifiable {
    case small = "12 × 16 in"
    case medium = "16 × 20 in"
    case large = "20 × 24 in"

    var id: String { rawValue }

    var basePrice: Decimal {
        switch self {
        case .small: 85
        case .medium: 120
        case .large: 165
        }
    }
}

struct FrameConfiguration: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let style: FrameStyle
    let size: FrameSize
    let hasMat: Bool
    let estimatedPrice: Decimal

    init(title: String, style: FrameStyle, size: FrameSize, hasMat: Bool) {
        self.title = title
        self.style = style
        self.size = size
        self.hasMat = hasMat
        self.estimatedPrice = size.basePrice + style.priceAdjustment + (hasMat ? 15 : 0)
    }
}
