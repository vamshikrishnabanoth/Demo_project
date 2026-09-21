/**
 * Unified Bins Color Palette across the entire application.
 * Contains both earlier and newly added color sets.
 */
export const BIN_COLORS = [
    // Initial color set
    '#FF0052',
    '#FFD400',
    '#00C68D',
    '#0055DA',
    'rgb(255, 91, 91)',
    'rgb(240, 255, 195)',
    'rgb(156, 207, 255)',
    'rgb(104, 90, 255)',
    'rgb(0, 234, 211)',
    'rgb(255, 245, 183)',
    'rgb(255, 68, 159)',
    'rgb(0, 95, 153)',

    // Extended color set
    'rgb(138, 118, 80)',
    'rgb(142, 151, 125)',
    'rgb(236, 231, 209)',
    'rgb(219, 206, 165)',
    'rgb(79, 91, 42)',
    'rgb(184, 137, 45)',
    'rgb(216, 201, 168)',
    'rgb(189, 85, 121)',
    'rgb(234, 157, 157)'
];

export const SECTION_MASTERY_COLORS = BIN_COLORS;

export const getBinColor = (index) => {
    return BIN_COLORS[index % BIN_COLORS.length];
};

export default BIN_COLORS;
