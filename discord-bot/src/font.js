// Maps A-Z, a-z, 0-9 to Unicode "Mathematical Sans-Serif Bold" so names render in a clean alt font.
function sansBold(text) {
  return [...text].map((ch) => {
    const c = ch.codePointAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(0x1d5d4 + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(0x1d5ee + c - 97);
    if (c >= 48 && c <= 57) return String.fromCodePoint(0x1d7ec + c - 48);
    return ch;
  }).join('');
}
module.exports = { sansBold };
