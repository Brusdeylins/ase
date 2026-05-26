;  Rust: capture structs, traits, enums, impl blocks, and free functions.
;  Methods inside impl blocks are function_item nodes; capturing all
;  function_item as @method.def attaches them to their enclosing impl_item
;  (captured as @class.def) via the AST walk in extract.ts.  The duplicate
;  symbol created by struct_item + impl_item sharing the same name is
;  collapsed by extract.ts via a per-file (file, name) merge pass.

(struct_item
    name: (type_identifier) @class.name) @class.def

(trait_item
    name: (type_identifier) @interface.name) @interface.def

(enum_item
    name: (type_identifier) @enum.name) @enum.def

(impl_item
    type: (type_identifier) @class.name) @class.def

(function_item
    name: (identifier) @method.name) @method.def
