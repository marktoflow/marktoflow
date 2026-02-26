import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProviderSwitcher } from '../../src/client/components/Settings/ProviderSwitcher';
import type { Provider } from '../../src/client/stores/agentStore';

const useAgentStoreMock = vi.fn();

vi.mock('../../src/client/stores/agentStore', () => ({
  useAgentStore: () => useAgentStoreMock(),
}));

describe('ProviderSwitcher OAuth messages', () => {
  const loadProviders = vi.fn().mockResolvedValue(undefined);
  const setProvider = vi.fn().mockResolvedValue(true);
  const fetchMock = vi.fn();

  const providers: Provider[] = [
    {
      id: 'claude-agent',
      name: 'Claude Agent',
      status: 'needs_config',
      isActive: false,
      authType: 'sdk',
      oauthSupported: true,
    },
    {
      id: 'codex',
      name: 'Codex',
      status: 'needs_config',
      isActive: false,
      authType: 'sdk',
      oauthSupported: true,
    },
  ];

  beforeEach(() => {
    loadProviders.mockClear();
    setProvider.mockClear();
    useAgentStoreMock.mockReturnValue({
      providers,
      activeProviderId: null,
      isLoading: false,
      error: null,
      loadProviders,
      setProvider,
    });

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'OAuth started for Claude Agent.' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens OAuth authUrl returned by the provider start endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: 'OAuth started for Claude Agent.',
        authUrl: 'https://claude.ai/oauth/device',
      }),
    });

    render(<ProviderSwitcher open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByText('Claude Agent'));
    fireEvent.click(screen.getByRole('button', { name: 'Authenticate with OAuth' }));

    await screen.findByText('OAuth started for Claude Agent.');
    expect(window.open).toHaveBeenCalledWith('https://claude.ai/oauth/device', '_blank', 'noopener,noreferrer');
  });

  it('shows OAuth error message when provider start endpoint fails', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'OAuth service unavailable' }),
    });

    render(<ProviderSwitcher open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByText('Claude Agent'));
    fireEvent.click(screen.getByRole('button', { name: 'Authenticate with OAuth' }));

    await screen.findByText('OAuth service unavailable');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('does not show stale OAuth message after switching providers', async () => {
    render(<ProviderSwitcher open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByText('Claude Agent'));
    fireEvent.click(screen.getByRole('button', { name: 'Authenticate with OAuth' }));

    await screen.findByText('OAuth started for Claude Agent.');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByText('Codex'));

    await waitFor(() => {
      expect(screen.queryByText('OAuth started for Claude Agent.')).not.toBeInTheDocument();
    });
  });
});

describe('ProviderSwitcher config actions', () => {
  const loadProviders = vi.fn().mockResolvedValue(undefined);
  const setProvider = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    loadProviders.mockClear();
    setProvider.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens config modal from ready provider settings button', async () => {
    useAgentStoreMock.mockReturnValue({
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          status: 'ready',
          isActive: false,
          authType: 'oauth',
          configOptions: { apiKey: true },
        },
      ],
      activeProviderId: null,
      isLoading: false,
      error: null,
      loadProviders,
      setProvider,
    });

    render(<ProviderSwitcher open={true} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByTitle('Configure provider'));
    expect(await screen.findByText('Configure OpenAI')).toBeInTheDocument();
  });

  it('saves non-sdk config and activates provider', async () => {
    const onOpenChange = vi.fn();
    useAgentStoreMock.mockReturnValue({
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          status: 'needs_config',
          isActive: false,
          authType: 'oauth',
          configOptions: { apiKey: true, baseUrl: true, model: true },
        },
      ],
      activeProviderId: null,
      isLoading: false,
      error: null,
      loadProviders,
      setProvider,
    });

    render(<ProviderSwitcher open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText('OpenAI'));
    fireEvent.change(screen.getByPlaceholderText('Enter API key'), { target: { value: 'sk-test' } });
    fireEvent.change(screen.getByPlaceholderText('Enter base URL'), { target: { value: 'http://localhost:11434/v1' } });
    fireEvent.change(screen.getByPlaceholderText('Enter model name (e.g., gpt-4o, claude-sonnet-4-20250514)'), { target: { value: 'gpt-4o-mini' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save & Activate' }));

    await waitFor(() => {
      expect(setProvider).toHaveBeenCalledWith('openai', {
        apiKey: 'sk-test',
        baseUrl: 'http://localhost:11434/v1',
        model: 'gpt-4o-mini',
      });
    });
  });

  it('activates sdk provider from config modal', async () => {
    const onOpenChange = vi.fn();
    useAgentStoreMock.mockReturnValue({
      providers: [
        {
          id: 'claude-agent',
          name: 'Claude Agent',
          status: 'available',
          isActive: false,
          authType: 'sdk',
          oauthSupported: true,
        },
      ],
      activeProviderId: null,
      isLoading: false,
      error: null,
      loadProviders,
      setProvider,
    });

    render(<ProviderSwitcher open={true} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByText('Claude Agent'));
    fireEvent.click(screen.getByRole('button', { name: 'Connect & Activate' }));

    await waitFor(() => {
      expect(setProvider).toHaveBeenCalledWith('claude-agent', undefined);
    });
  });
});
