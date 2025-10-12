import { Node } from './Node'
import type { NodeData } from '../types/index'

export class Group extends Node {
  name: 'group'

  constructor(data: NodeData = {}) {
    super(data)
    this.name = 'group'
  }

  override copy(source: Node, recursive?: boolean): this {
    super.copy(source, recursive)
    return this
  }

  override getProxy(): ReturnType<Node['getProxy']> {
    if (!this.proxy) {
      let proxy = {
        // ...
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
