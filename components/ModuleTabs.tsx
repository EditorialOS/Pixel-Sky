'use client';

import { MODULES, ModuleType } from '@/lib/types';

interface ModuleTabsProps {
  activeModule?: ModuleType;
  onModuleClick: (module: ModuleType) => void;
}

export function ModuleTabs({ activeModule, onModuleClick }: ModuleTabsProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {MODULES.map((module) => (
        <button
          key={module.id}
          onClick={() => onModuleClick(module.id)}
          className={`module-pill whitespace-nowrap ${
            activeModule === module.id
              ? 'bg-os-accent/20 text-os-accent border border-os-accent/30'
              : 'bg-os-surface border border-os-border text-os-muted hover:text-os-text hover:border-os-muted'
          }`}
        >
          <span>{module.icon}</span>
          <span>{module.name}</span>
        </button>
      ))}
    </div>
  );
}
