const ZERO_WIDTH_SPACE = '\u200b';
const UNIT = `||${ZERO_WIDTH_SPACE}||`;
const INVISIBLE_PATTERN = UNIT.repeat(240);
const MAX_CONTENT = 2000;

module.exports = { INVISIBLE_PATTERN, MAX_CONTENT };