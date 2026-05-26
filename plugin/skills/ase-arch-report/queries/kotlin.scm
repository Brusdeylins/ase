;  Kotlin: the grammar exposes no field names, so we match positionally.
;  Note: extract.ts uses childForFieldName("name") which returns null for
;  Kotlin nodes, so symbol names will currently render as "<anon>".  The
;  queries themselves compile cleanly; refinement is tracked separately.

(class_declaration
    (type_identifier) @class.name) @class.def

(function_declaration
    (simple_identifier) @method.name) @method.def
