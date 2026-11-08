import ts from 'typescript';
/** Source catalog only. Recognizes scoped paths and selectors, never certifies erasure. */
export function tenantCollectionNames(source) {
  const file=ts.createSourceFile('inventory.ts',source,ts.ScriptTarget.Latest,true);
  const bindings=new Map(), names=new Set();
  function walk(node,fn) {fn(node);ts.forEachChild(node,child=>walk(child,fn));}
  function bind(name,value) {const values=bindings.get(name)??[];values.push(value);bindings.set(name,values);}
  walk(file,node=>{
    if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)bind(node.name.text,node.initializer);
    if(ts.isForOfStatement(node)&&ts.isVariableDeclarationList(node.initializer)&&ts.isArrayLiteralExpression(node.expression)) {
      const name=node.initializer.declarations[0]?.name;
      if(name&&ts.isIdentifier(name))for(const value of node.expression.elements)bind(name.text,value);
    }
  });
  function values(node,depth=0) {
    if(!node||depth>8)return [];
    if(ts.isStringLiteralLike(node))return [node.text];
    if(ts.isIdentifier(node))return (bindings.get(node.text)??[]).flatMap(value=>values(value,depth+1));
    if(ts.isTemplateExpression(node)) {
      let result=[node.head.text];
      for(const span of node.templateSpans) {
        const choices=values(span.expression,depth+1); result=result.flatMap(prefix=>(choices.length?choices:['*']).map(value=>prefix+value+span.literal.text));
      }
      return result;
    }
    return [];
  }
  function record(node) {
    for(const path of values(node)) {
      const segments=path.split('/');
      for(let index=0;index<segments.length;index+=2)if(/^[a-z_]+$/.test(segments[index]))names.add(segments[index]);
    }
  }
  walk(file,node=>{
    if(!ts.isCallExpression(node))return;
    if(ts.isPropertyAccessExpression(node.expression)) {
      const method=node.expression.name.text,receiver=node.expression.expression.getText(file);
      if(['repo','repository','db','tx','firestore','accounting'].includes(receiver)&&['read','write','create','delete','list','listAll','deleteTree','deleteDocument','deleteChat'].includes(method))record(node.arguments[0]);
    }
    if(ts.isIdentifier(node.expression)&&['select','readStored'].includes(node.expression.text))record(node.arguments[node.expression.text==='readStored'?1:0]);
  });
  return names;
}
