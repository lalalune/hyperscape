import { NodeData } from '../types/index'
import * as Nodes from '../nodes'

export function createNode(name: string, data?: NodeData): Nodes.Node {
  const NodeConstructor = (Nodes as Record<string, typeof Nodes.Node>)[name]
  if (!NodeConstructor) console.error('unknown node:', name)
  const node = new NodeConstructor(data)
  return node
}
