import ast

checks = [
    ("main.py",       ["_run_inference","detect_ws","health","upload_video"]),
    ("compliance.py", ["evaluate_compliance","_association_score","_evaluate_worker","_iou"]),
    ("config.py",     []),
]

for fname, funcs in checks:
    with open(fname) as f:
        src = f.read()
    tree = ast.parse(src)
    defined = {n.name for n in ast.walk(tree)
               if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
    missing = [fn for fn in funcs if fn not in defined]

    flags = []
    if fname == "main.py":
        flags.append("model.track=" + str("model.track" in src))
    if fname == "compliance.py":
        flags.append("compliant_field=" + str('"compliant"' in src))
    flags.append("OVERLAP_THRESHOLD=" + str("OVERLAP_THRESHOLD" in src))

    status = "OK " if not missing else "ERR missing=" + str(missing)
    print(status, fname, " | ".join(flags))
