import type {
  AgentAdapterPort,
  AgentInvocationRequest,
  AgentInvocationResult,
  AgentName,
} from './types.js';

export class FakeAgentAdapter implements AgentAdapterPort {
  readonly calls: AgentInvocationRequest[] = [];

  constructor(
    readonly name: AgentName,
    private readonly resolve: (request: AgentInvocationRequest) => AgentInvocationResult = () => ({
      agent: name,
      exitCode: 0,
      stdout: '',
      stderr: '',
    }),
  ) {}

  async invoke(request: AgentInvocationRequest): Promise<AgentInvocationResult> {
    this.calls.push(request);
    return this.resolve(request);
  }
}
