import {
  MessageSquare,
  GitBranch,
  ClipboardList,
  Mail,
  Calendar,
  Trello,
  FileText,
  MessageCircle,
  Database,
  Globe,
  Bot,
  Zap,
  HelpCircle,
  Phone,
  Send,
  ShoppingCart,
  Headphones,
  Users,
  CheckSquare,
  Cloud,
  HardDrive,
  CreditCard,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

const serviceIcons: Record<string, IconComponent> = {
  slack: MessageSquare,
  github: GitBranch,
  jira: ClipboardList,
  gmail: Mail,
  outlook: Calendar,
  linear: Trello,
  notion: FileText,
  discord: MessageCircle,
  airtable: Database,
  confluence: FileText,
  http: Globe,
  claude: Bot,
  opencode: Bot,
  ollama: Bot,
  webhook: Zap,
  schedule: Calendar,
  trigger: Zap,
  stripe: CreditCard,
  teams: Users,
  twilio: Phone,
  sendgrid: Send,
  shopify: ShoppingCart,
  zendesk: Headphones,
  mailchimp: Mail,
  asana: CheckSquare,
  trello: Trello,
  dropbox: Cloud,
  's3': HardDrive,
  'aws-s3': HardDrive,
};

export function getServiceIcon(serviceName: string): IconComponent {
  const normalizedName = serviceName.toLowerCase().split('.')[0];
  return serviceIcons[normalizedName] || HelpCircle;
}

export function getServiceColor(serviceName: string): string {
  const colors: Record<string, string> = {
    slack: '#4A154B',
    github: '#24292e',
    jira: '#0052CC',
    gmail: '#EA4335',
    outlook: '#0078D4',
    linear: '#5E6AD2',
    notion: '#000000',
    discord: '#5865F2',
    airtable: '#FFBF00',
    confluence: '#0052CC',
    http: '#00D1B2',
    claude: '#CC785C',
    opencode: '#00A67E',
    ollama: '#1a1a2e',
    stripe: '#635BFF',
    teams: '#6264A7',
    twilio: '#F22F46',
    sendgrid: '#1A82E2',
    shopify: '#96BF48',
    zendesk: '#03363D',
    mailchimp: '#FFE01B',
    asana: '#F06A6A',
    trello: '#0079BF',
    dropbox: '#0061FF',
    's3': '#FF9900',
    'aws-s3': '#FF9900',
  };

  const normalizedName = serviceName.toLowerCase().split('.')[0];
  return colors[normalizedName] || '#6B7280';
}
