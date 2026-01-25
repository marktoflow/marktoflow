import { describe, it, expect, beforeEach } from 'vitest';
import { useNavigationStore } from '../../src/client/stores/navigationStore';

describe('navigationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useNavigationStore.setState({ breadcrumbs: [] });
  });

  describe('setRootWorkflow', () => {
    it('should set the root workflow as the only breadcrumb', () => {
      const { setRootWorkflow } = useNavigationStore.getState();

      setRootWorkflow({
        id: 'root-1',
        name: 'Root Workflow',
        path: '/workflows/root.md',
      });

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(1);
      expect(state.breadcrumbs[0].id).toBe('root-1');
      expect(state.breadcrumbs[0].name).toBe('Root Workflow');
      expect(state.breadcrumbs[0].path).toBe('/workflows/root.md');
    });

    it('should replace existing breadcrumbs', () => {
      const { setRootWorkflow, pushWorkflow } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root-1', name: 'Root 1', path: '/root1.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });

      // Reset with new root
      setRootWorkflow({ id: 'root-2', name: 'Root 2', path: '/root2.md' });

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(1);
      expect(state.breadcrumbs[0].id).toBe('root-2');
    });
  });

  describe('pushWorkflow', () => {
    it('should add a workflow to the breadcrumb trail', () => {
      const { setRootWorkflow, pushWorkflow } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub Workflow 1', path: '/sub1.md' });

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(2);
      expect(state.breadcrumbs[1].id).toBe('sub-1');
    });

    it('should allow multiple nested workflows', () => {
      const { setRootWorkflow, pushWorkflow } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });
      pushWorkflow({ id: 'sub-2', name: 'Sub 2', path: '/sub2.md' });
      pushWorkflow({ id: 'sub-3', name: 'Sub 3', path: '/sub3.md' });

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(4);
      expect(state.breadcrumbs.map(b => b.id)).toEqual(['root', 'sub-1', 'sub-2', 'sub-3']);
    });
  });

  describe('popWorkflow', () => {
    it('should remove the last workflow from the trail', () => {
      const { setRootWorkflow, pushWorkflow, popWorkflow } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });
      pushWorkflow({ id: 'sub-2', name: 'Sub 2', path: '/sub2.md' });

      popWorkflow();

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(2);
      expect(state.breadcrumbs[1].id).toBe('sub-1');
    });

    it('should not remove the root workflow', () => {
      const { setRootWorkflow, popWorkflow } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      popWorkflow();
      popWorkflow(); // Try to pop again

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(1);
      expect(state.breadcrumbs[0].id).toBe('root');
    });
  });

  describe('popToIndex', () => {
    it('should navigate to a specific breadcrumb', () => {
      const { setRootWorkflow, pushWorkflow, popToIndex } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });
      pushWorkflow({ id: 'sub-2', name: 'Sub 2', path: '/sub2.md' });
      pushWorkflow({ id: 'sub-3', name: 'Sub 3', path: '/sub3.md' });

      popToIndex(1); // Go to sub-1

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(2);
      expect(state.breadcrumbs[1].id).toBe('sub-1');
    });

    it('should navigate to root', () => {
      const { setRootWorkflow, pushWorkflow, popToIndex } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });

      popToIndex(0); // Go to root

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(1);
      expect(state.breadcrumbs[0].id).toBe('root');
    });

    it('should handle invalid index gracefully', () => {
      const { setRootWorkflow, pushWorkflow, popToIndex } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });

      popToIndex(5); // Invalid index
      popToIndex(-1); // Invalid index

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(2); // Should remain unchanged
    });
  });

  describe('resetNavigation', () => {
    it('should clear all breadcrumbs', () => {
      const { setRootWorkflow, pushWorkflow, resetNavigation } = useNavigationStore.getState();

      setRootWorkflow({ id: 'root', name: 'Root', path: '/root.md' });
      pushWorkflow({ id: 'sub-1', name: 'Sub 1', path: '/sub1.md' });

      resetNavigation();

      const state = useNavigationStore.getState();
      expect(state.breadcrumbs).toHaveLength(0);
    });
  });
});
