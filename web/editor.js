// Highlighting only: these token patterns mirror scripturec/src/lexer.rs.
// Parsing, validation, and execution remain entirely in the Rust interpreter.
if (window.Prism) {
  Prism.languages.scripture = {
    // Backslashes are literal in Scripture. Also color strings being typed.
    string: /"[^"\r\n]*(?:"|$)/m,
    keyword:
      /\b(?:let there be|make it so that|genesis|commandment|rejoice|preach|prophecy|amen|pray|praise|sin|confess|absolve|if|else)\b/,
    builtin: /\b(?:time of our lord|_scripture_version_|_scripture_credits_)\b/,
    boolean: /\b(?:veritas|vero|verdadero|true|falsitas|falso|false)\b/,
    number: /\b[0-9]+(?:\.[0-9]+)?\b/,
    operator: /\b(?:not equal|and|or|not)\b|==|!=|[=+*/<>!-]/,
    punctuation: /[():,;]/,
  };

  if (window.codeInput) {
    const editor = document.getElementById('source');
    editor.addEventListener('code-input_load', () => {
      // code-input replaces the fallback textarea; retain its label target.
      editor.textareaElement.id = 'source-textarea';
      editor.textareaElement.setAttribute('autocapitalize', 'off');
    });
    codeInput.registerTemplate(
      'scripture',
      new codeInput.templates.Prism(Prism),
    );
  }
}
