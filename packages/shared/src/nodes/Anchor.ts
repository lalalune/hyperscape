import { Node } from './Node'
import type { NodeData } from '../types'

export class Anchor extends Node {
  anchorId!: string;
  
  constructor(data: NodeData = {}) {
    super(data)
    this.name = 'anchor'
  }

  override copy(source: Anchor, recursive: boolean) {
    super.copy(source, recursive)
    return this
  }

  override mount() {
    this.anchorId = `${this.ctx!.entity!.id}:${this.id}`
    this.ctx!.anchors.add(this.anchorId, this.matrixWorld)
  }

  override unmount() {
    this.ctx!.anchors.remove(this.anchorId)
  }

  override getProxy() {
    if (!this.proxy) {
      const self = this
      let proxy = {
        get anchorId() {
          return self.anchorId
        },
      }
      proxy = Object.defineProperties(proxy, Object.getOwnPropertyDescriptors(super.getProxy())) // inherit Node properties
      this.proxy = proxy
    }
    return this.proxy
  }
}
