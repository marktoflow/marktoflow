/**
 * Asana Integration
 *
 * Project and task management platform.
 * API Docs: https://developers.asana.com/docs
 * SDK: https://github.com/Asana/node-asana
 */

// @ts-expect-error - asana doesn't have types
import asana from 'asana';
import { ToolConfig, SDKInitializer } from '@marktoflow/core';

export interface AsanaTask {
  gid?: string;
  name: string;
  notes?: string;
  assignee?: string;
  due_on?: string;
  due_at?: string;
  completed?: boolean;
  projects?: string[];
  tags?: string[];
  workspace?: string;
}

export interface AsanaProject {
  gid?: string;
  name: string;
  notes?: string;
  workspace?: string;
  team?: string;
  archived?: boolean;
  public?: boolean;
  color?: string;
}

export interface AsanaSection {
  gid?: string;
  name: string;
  project: string;
}

/**
 * Asana client wrapper for workflow integration
 */
export class AsanaClient {
  constructor(private client: asana.Client) {}

  // ==================== Tasks ====================

  /**
   * Get task by ID
   */
  async getTask(taskGid: string) {
    return await this.client.tasks.getTask(taskGid);
  }

  /**
   * Create task
   */
  async createTask(task: AsanaTask) {
    return await this.client.tasks.createTask(task);
  }

  /**
   * Update task
   */
  async updateTask(taskGid: string, task: Partial<AsanaTask>) {
    return await this.client.tasks.updateTask(taskGid, task);
  }

  /**
   * Delete task
   */
  async deleteTask(taskGid: string) {
    return await this.client.tasks.deleteTask(taskGid);
  }

  /**
   * Get tasks in project
   */
  async getTasksInProject(projectGid: string, options?: { opt_fields?: string }) {
    return await this.client.tasks.getTasksForProject(projectGid, options);
  }

  /**
   * Get tasks for user
   */
  async getTasksForUser(userGid: string, workspace: string, options?: { opt_fields?: string }) {
    return await this.client.tasks.getTasksForUserTaskList(userGid, { workspace, ...options });
  }

  /**
   * Add comment to task
   */
  async addComment(taskGid: string, text: string) {
    return await this.client.tasks.addComment(taskGid, { text });
  }

  // ==================== Projects ====================

  /**
   * Get project by ID
   */
  async getProject(projectGid: string) {
    return await this.client.projects.getProject(projectGid);
  }

  /**
   * Create project
   */
  async createProject(project: AsanaProject) {
    return await this.client.projects.createProject(project);
  }

  /**
   * Update project
   */
  async updateProject(projectGid: string, project: Partial<AsanaProject>) {
    return await this.client.projects.updateProject(projectGid, project);
  }

  /**
   * Delete project
   */
  async deleteProject(projectGid: string) {
    return await this.client.projects.deleteProject(projectGid);
  }

  /**
   * Get projects in workspace
   */
  async getProjectsInWorkspace(workspaceGid: string, options?: { opt_fields?: string; archived?: boolean }) {
    return await this.client.projects.getProjects({ workspace: workspaceGid, ...options });
  }

  /**
   * Get projects in team
   */
  async getProjectsInTeam(teamGid: string, options?: { opt_fields?: string; archived?: boolean }) {
    return await this.client.projects.getProjectsForTeam(teamGid, options);
  }

  // ==================== Sections ====================

  /**
   * Get sections in project
   */
  async getSectionsInProject(projectGid: string) {
    return await this.client.sections.getSectionsForProject(projectGid);
  }

  /**
   * Create section
   */
  async createSection(section: AsanaSection) {
    return await this.client.sections.createSectionForProject(section.project, { name: section.name });
  }

  /**
   * Update section
   */
  async updateSection(sectionGid: string, name: string) {
    return await this.client.sections.updateSection(sectionGid, { name });
  }

  /**
   * Delete section
   */
  async deleteSection(sectionGid: string) {
    return await this.client.sections.deleteSection(sectionGid);
  }

  /**
   * Add task to section
   */
  async addTaskToSection(sectionGid: string, taskGid: string) {
    return await this.client.sections.addTaskForSection(sectionGid, { task: taskGid });
  }

  // ==================== Workspaces ====================

  /**
   * Get workspaces
   */
  async getWorkspaces() {
    return await this.client.workspaces.getWorkspaces();
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceGid: string) {
    return await this.client.workspaces.getWorkspace(workspaceGid);
  }

  // ==================== Users ====================

  /**
   * Get current user
   */
  async getCurrentUser() {
    return await this.client.users.getUser('me');
  }

  /**
   * Get user by ID
   */
  async getUser(userGid: string) {
    return await this.client.users.getUser(userGid);
  }

  /**
   * Get users in workspace
   */
  async getUsersInWorkspace(workspaceGid: string) {
    return await this.client.users.getUsersForWorkspace(workspaceGid);
  }

  // ==================== Tags ====================

  /**
   * Get tag by ID
   */
  async getTag(tagGid: string) {
    return await this.client.tags.getTag(tagGid);
  }

  /**
   * Create tag
   */
  async createTag(workspace: string, name: string, color?: string) {
    return await this.client.tags.createTag({ workspace, name, color });
  }

  /**
   * Get tags in workspace
   */
  async getTagsInWorkspace(workspaceGid: string) {
    return await this.client.tags.getTagsForWorkspace(workspaceGid);
  }
}

export const AsanaInitializer: SDKInitializer = {
  async initialize(_module: unknown, config: ToolConfig): Promise<unknown> {
    const accessToken = config.auth?.['access_token'] as string | undefined;

    if (!accessToken) {
      throw new Error('Asana SDK requires auth.access_token');
    }

    const client = asana.Client ? asana.Client.create().useAccessToken(accessToken) : asana.default?.Client?.create().useAccessToken(accessToken);

    const wrapper = new AsanaClient(client);

    return {
      client: wrapper,
      actions: wrapper,
      rawClient: client,
    };
  },
};
