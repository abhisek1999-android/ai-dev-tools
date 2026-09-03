import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tools/token-calculator',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () =>
      import('./features/home/home.component').then(m => m.HomeComponent),
  },
  {
    path: 'tools/token-calculator',
    loadComponent: () =>
      import('./features/token-calculator/token-calculator.component').then(m => m.TokenCalculatorComponent),
  },
  {
    path: 'tools/llm-cost-calculator',
    loadComponent: () =>
      import('./features/llm-cost-calculator/llm-cost-calculator.component').then(m => m.LlmCostCalculatorComponent),
  },
  {
    path: 'tools/model-comparison',
    loadComponent: () =>
      import('./features/model-comparison/model-comparison.component').then(m => m.ModelComparisonComponent),
  },
  {
    path: 'tools/context-window-calculator',
    loadComponent: () =>
      import('./features/context-window-calculator/context-window-calculator.component').then(m => m.ContextWindowCalculatorComponent),
  },
  {
    path: 'tools/rag-cost-calculator',
    loadComponent: () =>
      import('./features/rag-cost-calculator/rag-cost-calculator.component').then(m => m.RagCostCalculatorComponent),
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./features/blog/blog-list.component').then(m => m.BlogListComponent),
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./features/blog/blog-post.component').then(m => m.BlogPostComponent),
  },
  { path: '**', redirectTo: '/tools/token-calculator' },
];
