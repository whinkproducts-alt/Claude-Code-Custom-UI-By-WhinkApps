// Approval rules shared by the server (validates what the page sends) and the page (decides which cards get an Approve button).
// An approval may name ONE exact command or ONE web domain. No wildcards.
//
// Why parentheses are checked: Claude Code splits a rule list on spaces and commas outside parentheses, so a command like
//   x) Bash(rm -rf ~
// inside `Bash(...)` would become TWO rules and the second would be honored. Requiring balanced parentheses makes that impossible.
(function (root) {
  const balanced = (s) => { let depth = 0; for (const c of s) { if (c === '(') depth++; else if (c === ')' && --depth < 0) return false; } return depth === 0; };
  const BASH = /^Bash\(([^*\n]{1,2000})\)$/;
  const WEB = /^WebFetch\(domain:[A-Za-z0-9.-]{1,253}\)$/;
  const isApproval = (rule) => {
    if (typeof rule !== 'string') return false;
    const m = rule.match(BASH);
    return m ? balanced(m[1]) : WEB.test(rule);
  };
  root.APPROVAL_RULES = { isApproval, balanced };
  if (typeof module !== 'undefined') module.exports = root.APPROVAL_RULES;
})(typeof window !== 'undefined' ? window : globalThis);
