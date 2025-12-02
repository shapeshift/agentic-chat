'use client'

import * as React from 'react'

import { ConversationList } from './ConversationList'
import { Sidebar, SidebarContent, SidebarHeader, SidebarRail } from './ui/Sidebar'

export const SidebarLeft: React.FC<React.ComponentProps<typeof Sidebar>> = ({ ...props }) => {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">ShapeShift Agent</div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <ConversationList />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
