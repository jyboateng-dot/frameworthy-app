// All geometry is measured in the original 1536 x 1024 photo coordinates.
// Black cuts wall out of the foreground; white restores an object's silhouette.
// Keeping corrections here (rather than in painted image exports) makes them
// independent of wall colour, viewport size, and frame placement.
export const ROOM_PHOTO_MASKS = {
    'studio-loft': {
        foliage: [{ x: 1340, y: 576, width: 196, height: 291 }],
        corrections: [],
    },
    'dining-room': {
        foliage: [{ x: 20, y: 585, width: 147, height: 215 }],
        corrections: [
            // Wall slivers between the chair posts and the rear seat cushions.
            { fill: 'black', d: 'M401 826 L423 831 L423 851 L401 867 Z' },
            { fill: 'black', d: 'M605 809 L612 804 L615 863 L606 863 Z' },
            { fill: 'black', d: 'M873 806 L886 801 L916 801 L915 864 L875 864 Z' },
            { fill: 'black', d: 'M931 838 L944 844 L944 863 L932 850 Z' },
            { fill: 'black', d: 'M1146 807 L1151 802 L1162 802 L1162 864 L1146 864 Z' },
            // Clear glass transmits the wall colour; keep its rim/reflections
            // opaque, but do not preserve a solid beige wall inside the glass.
            { fill: '#333', d: 'M1421 660 L1430 660 L1428 677 Q1427 686 1433 700 L1438 732 H1412 L1416 701 Q1423 683 1421 660 Z' },
            { fill: '#444', d: 'M1450 717 H1464 L1463 735 H1451 Z' },
        ],
    },
    bedroom: {
        foliage: [{ x: 330, y: 695, width: 79, height: 39 }],
        corrections: [
            // Replace bounding-box lamp masks with the actual tapered shades,
            // narrow stems, and rounded ceramic bases.
            { fill: 'black', d: 'M382 634 H474 V697 H448 V751 H440 V761 H405 V697 H382 Z' },
            { fill: 'white', d: 'M389 638 Q428 636 468 639 L470 691 Q428 696 386 691 Z M424 694 H431 V702 H424 Z M411 703 Q427 699 442 704 L443 753 Q443 762 428 764 L411 762 Q405 758 408 746 Z' },
            { fill: 'white', d: 'M432 753 Q450 750 469 753 Q468 764 451 765 Q435 765 432 753 Z' },
            { fill: 'black', d: 'M1059 634 H1151 V698 H1126 V761 H1084 V698 H1059 Z' },
            { fill: 'white', d: 'M1065 638 Q1104 636 1144 639 L1146 691 Q1104 695 1063 691 Z M1100 694 H1107 V702 H1100 Z M1090 703 Q1105 700 1120 704 L1122 757 Q1120 765 1106 765 Q1088 765 1087 758 Z' },
        ],
    },
    entryway: {
        foliage: [{ x: 861, y: 565, width: 75, height: 48 }],
        corrections: [
            // The automatic mask included a stepped strip of wall above the
            // straight door casing. Keep the trim below its source-photo edge.
            { fill: 'black', d: 'M1175 125 H1530 V144 H1175 Z' },
            // Follow the hanging textile rather than its cast shadow. The old
            // silhouette joined the tassels into a solid beige block.
            { fill: 'black', d: 'M103 475 L108 527 L111 556 L116 579 L120 586 L119 604 L111 606 L107 614 L98 615 L94 624 L86 628 L79 637 L67 643 L57 650 L48 652 L39 645 L33 632 L31 615 L26 594 L26 650 L26 660 H133 V475 Z' },
            // The front tassels overlap a second fabric fold: that backing
            // must stay opaque, even when it resembles the original beige wall.
            // The tote handles enclose wall, not solid bag material.
            { fill: 'black', d: 'M145 290 L150 284 L151 306 L156 353 L138 354 Z' },
            { fill: 'black', d: 'M154 289 L159 299 L172 357 L161 354 Z' },
            // Rebuild the opening between the console legs. The old hole
            // extended into the right rear leg, turning part of the wood white.
            { fill: 'white', d: 'M543 703 H975 V814 H543 Z' },
            { fill: 'black', d: 'M575 705 H945 L946 813 H574 Z' },
            { fill: 'black', d: 'M559 706 H564 L562 813 H558 Z' },
            // Reveal the wall between the glass vase's stems/leaves.
            { fill: 'black', d: 'M891 610 L897 611 L897 621 L891 624 Z' },
            { fill: '#666', d: 'M890 616 L900 616 L900 624 Q914 632 915 642 Q915 652 903 656 H888 Q876 652 876 643 Q877 632 890 624 Z' },
        ],
    },
    'home-office': {
        foliage: [
            { x: 0, y: 486, width: 220, height: 311 },
            { x: 1014, y: 668, width: 84, height: 33 },
            { x: 1071, y: 701, width: 63, height: 116 },
            { x: 1477, y: 479, width: 59, height: 99 },
            { x: 1470, y: 595, width: 66, height: 54 },
        ],
        corrections: [
            // Chair openings: backrest -> woven seat -> lower cross rail.
            { fill: 'black', d: 'M681 780 Q752 809 825 782 L826 823 Q752 828 680 820 Z' },
            { fill: 'black', d: 'M682 862 Q753 873 828 862 L829 883 L681 883 Z' },
            // The wall mask also erased the wooden lower stretcher. Restore
            // its full face so it cannot pick up the selected wall colour.
            { fill: 'white', d: 'M676 884 H829 V897 H676 Z' },
            // Trace the complete wall openings to the skirting. These replace
            // the old stepped rectangle edges beside the chair and drawers.
            { fill: 'black', d: 'M498 777 H668 L660 898 H486 Z' },
            { fill: 'black', d: 'M838 778 H899 V898 H850 L847 854 Q852 838 849 825 Q847 819 841 819 Z' },
            { fill: 'black', d: 'M1054 777 L1073 783 L1085 898 H1055 Z' },
            // Rounded pen cup and stacked books, not rectangular wall blocks.
            { fill: 'black', d: 'M488 702 H559 V729 H488 Z' },
            { fill: 'white', d: 'M491 721 L563 721 L563 729 H491 Z M515 706 Q534 704 553 706 L552 716 Q534 724 516 717 Z' },
        ],
    },
};

// A subpixel inset reduces the beige antialias fringe on solid silhouettes.
// Fine foliage uses a separate treatment. Applied in source coordinates,
// never screen pixels, so resizing cannot alter the mask/photo alignment.
export const ROOM_MASK_EDGE_INSET = 0.65;
