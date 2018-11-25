unsigned instr_date = 20171201;
copyright instructions_file( "instructions.cc", "Antti Valmari", instr_date );
/*
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>.
*/

/* This file prints short or long MathCheck user instructions. */


void instr_symb( const char *AM, const char *MC ){
  out_html( "<tr><td class=sym>`" ); out_print( AM );
  out_print( "`</td><td class=kbd>" ); out_print( MC );
  out_print( "</td></tr>\n" );
}


void instr_cmnd( const char *MC, const char *txt ){
  out_html( "<tr><td class=kbd>" ); out_print( MC );
  out_print( "</td><td class=sym>" ); out_print( txt );
  out_print( "</td></tr>\n" );
}


void instructions( bool is_long ){

  /* Header information */
  out_html( "\n\n<h1 class=help>MathCheck" );
  if( !is_long ){ out_print( " Brief" ); }
  out_print( " Instructions</h1>\n" );
  if( is_long ){
    out_print( "\n<p class=unimp>This document is as of " );
    html_date( instr_date );
    out_print( ". It lacks all more recent features of MathCheck.\n" );
  }
  out_print( "\n<p class=justify>In ready-made problems, the use of commands"
    " may have been restricted to those relevant for the problem." );
  if( is_long ){
    out_print( " There are two mechanisms towards this aim. If the textarea"
      " has the name \"exam\", then many commands are unavailable. Commands"
      " may also be banned by some commands mentioned below.\n" );
  }

  /* Lexical rules */
  if( is_long ){
    out_print( "\n<h2>Lexical Rules</h2>\n" );
    out_print( "\n<p class=justify>Spaces and newlines may be freely used"
      " between tokens.\n" );
    out_print( "If a non-numeric token ends and the next one starts with a"
      " letter or digit, there must be at least one space or newline in"
      " between.\n" );
    out_print( "<p class=justify>These symbols can also be given as Unicode"
      " characters:\n" );
    for( unsigned tk = tkn_Unot; tk <= tkn_Urfloor; ++tk ){
      out_print( ' ' ); out_print( tkn_str[ tk ] );
    }
  }

  /* Arithmetic and parentheses */
  out_print( "\n<h2>Arithmetic and Parentheses</h2>\n" );
  out_print( "\n<table>\n<tr>\n<td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "54321", "54321" );
  instr_symb( "frac(54)(321)", "54/321" );
  instr_symb( "54 frac(3)(21)", "54&nbsp;3/21" );
  instr_symb( "54.321", "54.321" );
  instr_symb( "pi", "pi" );
  instr_symb( "e", "e" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "+", "+" );
  instr_symb( "-", "-" );
  instr_symb( "*", "*" );
  instr_symb( "x/y", "x/y" );
  if( is_long ){ instr_symb( "frac(x+1)(2y)", "(x+1)/(2y)<br>#/(x+1)(2y)" ); }
  else{ instr_symb( "frac(x+1)(2y)", "(x+1)/(2y)" ); }
  instr_symb( "x^y", "x^y" );
  instr_symb( "x^(-y z)", "x^(-y z)" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "(", "(" );
  instr_symb( ")", ")" );
  instr_symb( "(", "#(" );
  instr_symb( ")", "#)" );
  instr_symb( "[", "[" );
  instr_symb( "]", "]" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "sqrt x+1", "sqrt&nbsp;x+1" );
  instr_symb( "sqrt(x+1)", "sqrt(x+1)" );
  instr_symb( "root(n)(x+1)", "root(n)(x+1)" );
  instr_symb( "|x+1|", "|x+1|<br>abs(x+1)" );
  instr_symb( "|__x+1__|", "|_x+1_|<br>floor(x+1)" );
  instr_symb( "|~x+1~|", "|^x+1^|<br>ceil(x+1)" );
  instr_symb( "del/(del x) sin 5x", "DD&nbsp;x&nbsp;sin&nbsp;5x" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "sin", "sin" );
  instr_symb( "cos", "cos" );
  instr_symb( "tan", "tan" );
  instr_symb( "cot", "cot" );
  instr_symb( "ln", "ln" );
  instr_symb( "log", "log" );
  instr_symb( "sinh", "sinh" );
  instr_symb( "cosh", "cosh" );
  instr_symb( "tanh", "tanh" );
  out_print( "</table>\n" );
  out_print( "</td>\n</tr>\n</table>\n" );
  if( is_long ){
    out_print( "\n<p class=justify>`A`, &hellip;, `Z`, `a`, &hellip;, `z`,"
      " and the Greek letters listed below can be used as variables,"
      " excluding `e` and `pi`.\n" );
    out_print( "If the problem mode assumes ordinary numbers, then `I`,"
      " &hellip;, `N` and `i`, &hellip;, `n` hold integer and others hold"
      " real values.\n" );
    out_print( "\n<p class=justify>MathCheck is not good in finding errors if"
      " the floor or ceiling function is used.\n" );
    out_print( "\n<p class=justify>MathCheck may remove unnecessary ordinary"
      " parentheses, but may not remove unnecessary hard parentheses"
      " <kbd>#(</kbd> and <kbd>#)</kbd>.\n" );
    out_print( "\n<p class=justify>MathCheck uses precise rational number"
      " arithmetic when it can and then reverts to intervals of"
      " double-precision values.\n" );
    out_print( "Also decimal number tokens yield rational values, whenever"
      " possible.\n" );
    out_print( "The functions <kbd>ddn</kbd> and <kbd>dup</kbd> return the"
      " lower and upper bound of the interval.\n" );
  }

  /* Comparisons and logic */
  out_print( "\n<h2>Comparisons and Logic</h2>\n" );
  out_print( "\n<table>\n<tr>\n<td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "&lt;=", "&lt;=" );
  instr_symb( "&lt;", "&lt;" );
  instr_symb( "=", "=" );
  instr_symb( "!=", "!=" );
  instr_symb( "&gt;=", "&gt;=" );
  instr_symb( "&gt;", "&gt;" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "not", "!<br>not" );
  instr_symb( "^^", "/\\<br>and<br>&&<br>^^" );
  instr_symb( "vv", "\\/<br>or<br>||<br>vv" );
  instr_symb( "rarr", "--&gt;" );
  instr_symb( "harr", "&lt;-&gt;" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "sf\"F\"", "FF" );
  instr_symb( "sf\"U\"", "UU" );
  instr_symb( "sf\"T\"", "TT" );
  instr_symb( "AA x:", "AA&nbsp;x:" );
  instr_symb( "AA i; 1 &lt;= i &lt;= n:",
    "AA&nbsp;i;&nbsp;1&nbsp;&lt;=&nbsp;i&nbsp;&lt;=&nbsp;n:" );
  instr_symb( "EE x:", "EE&nbsp;x:" );
  instr_symb( "EE i; 1 &lt;= i &lt;= n:",
    "EE&nbsp;i;&nbsp;1&nbsp;&lt;=&nbsp;i&nbsp;&lt;=&nbsp;n:" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "rArr", "==&gt;" );
  instr_symb( "lArr", "&lt;==" );
  instr_symb( "hArr", "&lt;=&gt;" );
  out_print( "</table>\n" );
  out_print( "</td>\n</tr>\n</table>\n" );

  if( !is_long ){ return; }

  /* Greek letters */
  out_print( "\n<h2>Greek Letters</h2>\n" );
  out_print( "\n<table>\n<tr>\n<td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "alpha", "al" );
  instr_symb( "beta", "be" );
  instr_symb( "gamma", "ga" );
  instr_symb( "delta", "de" );
  instr_symb( "varepsilon", "ve" );
  instr_symb( "epsilon", "ep" );
  instr_symb( "zeta", "ze" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "eta", "et" );
  instr_symb( "theta", "th" );
  instr_symb( "vartheta", "vt" );
  instr_symb( "iota", "io" );
  instr_symb( "kappa", "ka" );
  instr_symb( "lambda", "la" );
  instr_symb( "mu", "mu" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "nu", "nu" );
  instr_symb( "xi", "xi" );
  instr_symb( "omega", "om" );
  instr_symb( "rho", "rh" );
  instr_symb( "sigma", "si" );
  instr_symb( "tau", "ta" );
  instr_symb( "upsilon", "up" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "phi", "ph" );
  instr_symb( "varphi", "vp" );
  instr_symb( "chi", "ch" );
  instr_symb( "psi", "ps" );
  instr_symb( "omega", "om" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "Gamma", "Ga<br>GA" );
  instr_symb( "Delta", "De<br>DE" );
  instr_symb( "Theta", "Th<br>TH" );
  instr_symb( "Lambda", "La<br>LA" );
  instr_symb( "Xi", "Xi<br>XI" );
  out_print( "</table>\n" );
  out_print( "\n</td><td class=top>\n" );
  out_print( "\n<table class=border>\n" );
  instr_symb( "Pi", "Pi<br>PI" );
  instr_symb( "Sigma", "Si<br>SI" );
  instr_symb( "Phi", "Ph<br>PH" );
  instr_symb( "Psi", "Ps<br>PS" );
  instr_symb( "Omega", "Om<br>OM" );
  out_print( "</table>\n" );
  out_print( "</td>\n</tr>\n</table>\n" );

  /* Special commands */
  out_print( "\n<h2>Special Commands</h2>\n" );
  out_print( "\n<table class=border>\n" );
  instr_cmnd( "assume x != 1 /\\ y^2 &lt; sin x;", "Restrict the range of"
    " variables. Any comparisons and propositional operators may be used in"
    " the condition. One may use <kbd>enda</kbd> instead of <kbd>;</kbd>."
    " Works in the arithmetic, draw function, equation, modulo, and"
    " propositional logic modes. Unless otherwise stated, this must be next"
    " to the problem mode keyword." );
  instr_cmnd( "/**/", "Start a new line." );
  instr_cmnd( "/* two to the `n` is `2^n` */", "Write a comment and start a"
    " new line. Passages surrounded by grave accent characters will be shown"
    " as mathematics." );
  instr_cmnd( "skip_error", "If possible, continue checking even if there is"
    " an error." );
  instr_cmnd( "forget_errors", "Show the link to the next problem page even"
    " if the solution contains errors." );
  out_print( "</table>\n" );

  /* Problem modes and related */
  out_print( "\n<h2>Problem Modes and Related</h2>\n" );
  out_print( "\n<p class=justify>The versions with capital initial letter do"
    " and with small case do not reset most global settings.\n" );
  out_print( "\n<table class=border>\n" );
  instr_cmnd( "arithmetic", "Select the arithmetic mode. Checks a chain of"
    " arithmetic expressions separated by &lt;, &le;, =, &gt;, and &ge;." );
  instr_cmnd( "array_claim A[0...n-1]", "Select the array claim mode. Checks"
    " a chain of predicates on `A` separated by `hArr`. The index lower bound"
    " must be an integer. The upper bound must be a variable with an optional"
    " `+` or `−` integer. Does not show the first claim explicitly." );
  instr_cmnd( "brief_help", "Print short typing instructions." );
  instr_cmnd( "draw_function -10 10 -5 5;<br>x^2; 1/x; sin x", "Draw graphs"
    " of at most six functions. The numbers are the extreme coordinates: left"
    " right bottom top, and they are optional starting from the last." );
  instr_cmnd( "equation x=3 \\/ x=-1;<br>x^2 - 2x - 3 = 0 &lt;=&gt;", "Select"
    " the equation mode. In the solution, also `rArr` may be used, but then"
    " there must be <kbd>original</kbd> `hArr` later on. The teacher-given"
    " roots may also be <kbd>x FF</kbd>, to indicate that there are no roots;"
    " or <kbd>x</kbd>, to not give the roots (this last feature does not yet"
    " work well). One may use <kbd>ends</kbd> instead of <kbd>;</kbd>. The"
    " assume clause, if given, must be next to the teacher-given roots. The"
    " roots must certainly satisfy the assumption despite rounding errors." );
  instr_cmnd( "help", "Print this file." );
  instr_cmnd( "mathcheck", "Print copyright information. The resetting"
    " version is written as <kbd>MathCheck</kbd>." );
  instr_cmnd( "modulo 17<br>TT &lt;=&gt; EE x: x^2 = -1", "Select the modulo"
    " mode. Checks a chain of predicates separated by `lArr`, `hArr`, and"
    " `rArr`. The number must be between 2 and 25 inclusive." );
  instr_cmnd( "parse_tree", "Draw the expression tree of an expression, etc."
    " This command makes fewer sanity checks than usual." );
  instr_cmnd( "prop_logic", "Select the propositional logic mode. Checks a"
    " chain of propositions separated by `lArr`, `hArr`, and `rArr`." );
  instr_cmnd( "tree_compare 1(2+3);", "Select the expression tree comparison"
    " mode. Checks that the expressions have the same expression trees. Does"
    " not show the first expression explicitly." );
  out_print( "</table>\n" );

  /* Commands especially for teachers */
  out_print( "\n<h2>Commands Especially for Teachers</h2>\n" );
  out_print( "\n<table class=border>\n" );
  instr_cmnd( "#*", "This can be used to denote invisible multiplication as a"
    " top or banned operator." );
  instr_cmnd( "allow_comp", "The relation chain may contain &lt;, &le;, &gt;,"
    " and &ge; or &lArr; and &rArr;. This command is needed to cancel their"
    " automatic ban in exam textareas." );
  instr_cmnd( "b_nodes 48", "If the final expression yields at most 48 nodes,"
    " a bonus statement is printed." );
  instr_cmnd( "ban_comp", "The relation chain must not contain &lt;, &le;,"
    " &gt;, and &ge; or &lArr; and &rArr;." );
  instr_cmnd( "end_of_answer", "Prevents odd-looking error messages to the"
    " previous answer on the same page, when used in the beginning of the"
    " next question." );
  instr_cmnd( "f_ban ^ sqrt root;", "The final expression must not contain"
    " the listed operators. When banning <kbd>*</kbd>, it may make sense also"
    " ban <kbd>#*</kbd>, and vice versa.\n" );
  instr_cmnd( "f_CNF", "The final expression must be in conjunctional normal"
    " form or a product of sums." );
  instr_cmnd( "f_DNF", "The final expression must be in disjunctional normal"
    " form or a sum of products." );
  instr_cmnd( "f_nodes 56", "The final expression must not yield more than 56"
    " expression tree nodes." );
  instr_cmnd( "f_top_opr sqrt", "The top operator of the final expression"
    " must be `sqrt`. If the operator is `frac(del)(del ...)`, `AA`, or `EE`,"
    " also the variable must be given. The operator (independently of the"
    " variable) may not occur elsewhere in the expression. When using"
    " <kbd>*</kbd> as the operator, it may make sense to ban <kbd>#*</kbd>,"
    " and vice versa.\n" );
  instr_cmnd( "hide_expr", "Print &ldquo;model-solution&rdquo; instead of"
    " the next expression." );
  instr_cmnd( "next_URL https://...", "If the answer is correct, give the URL"
    " of the next problem page in the feedback." );
  instr_cmnd( "no_next_URL", "If the answer is correct, tell that this was"
    " the last problem in the series." );
  instr_cmnd( "solve x", "The final expression must be solved with respect to"
    " `x`." );
  out_print( "</table>\n" );

  /* Global settings */
  out_print( "\n<h2>Global Settings</h2>\n" );
  out_print( "\n<p class=justify>The effect of each <kbd>xxx_off</kbd> can be"
    " cancelled with <kbd>xxx_on</kbd> and vice versa.\n" );
  out_print( "\n<table class=border>\n" );
  instr_cmnd( "debug_on", "Make MathCheck print mysterious additional"
    " information." );
  instr_cmnd( "draw_off", "Do not draw the graphs of both sides when a"
    " relation fails." );
  instr_cmnd( "exam_on", "Do not give feedback on semantics." );
  instr_cmnd( "ok_text", "Print the text following this command for each"
    " correct answer. The text ends at the next empty line, and <kbd>#</kbd>"
    " acts as the escape character facilitating writing HTML." );
  instr_cmnd( "only_no_yes_on", "Do not print the information whose purpose"
    " is to help the student find the error. This is useful, for instance, if"
    " the correct answer is a number." );
  instr_cmnd( "prop3_on", "Use the undefined truth value also in the"
    " propositional logic mode." );
  instr_cmnd( "prove_off", "Do not attempt to prove relations, etc." );
  instr_cmnd( "verbose_off", "Do not print headers, etc., in the feedback." );
  out_print( "</table>\n" );

  /* Deprecated or removed commands */
  out_print( "\n<h2 class=debug>Deprecated or Removed Commands</h2>\n" );
  out_print( "\n<table class=border style=\"color: gray\">\n" );
  instr_cmnd( "newproblem", "Use <kbd>arithmetic</kbd>,"
    " <kbd>prop_logic</kbd>, etc., instead." );
  instr_cmnd( "#D", "Use <kbd>DD</kbd> instead." );
  instr_cmnd( "#xxx", "Use <kbd>xxx</kbd> instead. <kbd>#(</kbd>,"
    " <kbd>#)</kbd>, <kbd>#*</kbd>, and <kbd>#/</kbd> are not deprecated." );
  instr_cmnd( "f_ban_der", "Use <kbd>f_ban DD;</kbd> instead." );
  instr_cmnd( "lf", "Use <kbd>/**/</kbd> instead." );
  instr_cmnd( "undef_off", "This is pedagogically unwise, use the assume"
    " mechanism." );
  instr_cmnd( "funcpar_on", "Alternative rules for the parentheses cause"
    " confusion. Use <kbd>#(</kbd> and <kbd>#)</kbd> when necessary." );
  out_print( "</table>\n" );

}
