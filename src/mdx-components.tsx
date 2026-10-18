import defaultMdxComponents from 'fumadocs-ui/mdx';
import { D2Diagram } from '@vanhiep99w/docs-kit/components/d2';
import { D2InteractiveDiagram } from '@vanhiep99w/docs-kit/components/d2-interactive';
import { CodeWalkthrough } from '@vanhiep99w/docs-kit/components/code-walkthrough';
import { CodeDiff } from '@vanhiep99w/docs-kit/components/code-diff';
import { TerminalSession } from '@vanhiep99w/docs-kit/components/terminal-session';
import { ProtocolExchange } from '@vanhiep99w/docs-kit/components/protocol-exchange';
import { SpanWaterfall } from '@vanhiep99w/docs-kit/components/span-waterfall';
import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout, Card, Cards, Step, Steps, Tab, Tabs, Accordion, Accordions, TypeTable,
    D2Diagram, D2InteractiveDiagram,
    CodeWalkthrough, CodeDiff, TerminalSession, ProtocolExchange, SpanWaterfall,
    ...components,
  };
}
