import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ProjectInfo } from '../types'

export const useProjectStore = defineStore('project', () => {
  const recentProjects = ref<ProjectInfo[]>([])
  const currentProject = ref<string | null>(null)

  async function loadRecent() {
    recentProjects.value = await window.electronAPI.projectRecent()
  }

  async function openDialog(): Promise<string | null> {
    const dir = await window.electronAPI.projectOpenDialog()
    if (dir) {
      currentProject.value = dir
      await loadRecent()
    }
    return dir
  }

  function setCurrentProject(path: string) {
    currentProject.value = path
    window.electronAPI.projectAddRecent(path)
  }

  async function removeRecent(path: string) {
    await window.electronAPI.projectRemoveRecent(path)
    await loadRecent()
  }

  return {
    recentProjects,
    currentProject,
    loadRecent,
    openDialog,
    setCurrentProject,
    removeRecent,
  }
})
