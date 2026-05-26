;  Python: capture classes and their methods (function_definition nested in
;  class_definition is a method), plus top-level functions.

(class_definition
    name: (identifier) @class.name) @class.def

(function_definition
    name: (identifier) @function.name) @method.def
