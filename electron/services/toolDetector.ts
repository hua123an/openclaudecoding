import { allAdapters } from '../adapters'
import type { ToolDetectResult, CliToolInfo } from '../../src/types'

class ToolDetector {
  async detectAll(): Promise<ToolDetectResult[]> {
    const results = await Promise.all(
      allAdapters.map(async (adapter) => {
        const installed = await adapter.detect()
        return {
          id: adapter.id,
          installed,
          version: installed ? await adapter.getVersion() : '',
        }
      })
    )
    return results
  }

  async detectOne(toolId: string): Promise<ToolDetectResult | null> {
    const adapter = allAdapters.find((a) => a.id === toolId)
    if (!adapter) return null

    const installed = await adapter.detect()
    return {
      id: adapter.id,
      installed,
      version: installed ? await adapter.getVersion() : '',
    }
  }

  getToolList(): CliToolInfo[] {
    return allAdapters.map((a) => a.getInfo())
  }
}

export const toolDetector = new ToolDetector()
