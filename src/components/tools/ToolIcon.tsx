import type { ToolId } from '../../types/tools'

const iconProps = {
  viewBox: '0 0 24 24',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const

interface ToolIconProps {
  id: ToolId
}

export default function ToolIcon({ id }: ToolIconProps) {
  switch (id) {
    case 'coordinates':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="3" x2="12" y2="7" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="3" y1="12" x2="7" y2="12" />
          <line x1="17" y1="12" x2="21" y2="12" />
        </svg>
      )
    case 'distance':
      return (
        <svg {...iconProps}>
          <line x1="6" y1="12" x2="18" y2="12" />
          <path d="M6 12l3.5-3.5M6 12l3.5 3.5" />
          <path d="M18 12l-3.5-3.5M18 12l-3.5 3.5" />
        </svg>
      )
    case 'bearing':
      return (
        <svg {...iconProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M15.6 8.4l-1.9 5.3-5.3 1.9 1.9-5.3z" />
        </svg>
      )
    case 'utm-converter':
      return (
        <svg {...iconProps}>
          <rect x="4" y="4" width="16" height="16" rx="1.5" />
          <path d="M4 9.4h16M4 14.6h16M9.4 4v16M14.6 4v16" />
        </svg>
      )
    case 'polygon-area':
      return (
        <svg {...iconProps}>
          <path d="M12 4l7 5-2.6 8H7.6L5 9z" />
        </svg>
      )
    case 'polyline-length':
      return (
        <svg {...iconProps}>
          <path d="M4 17l5-8 5 5 6-8" />
          <circle cx="4" cy="17" r="1.4" />
          <circle cx="9" cy="9" r="1.4" />
          <circle cx="14" cy="14" r="1.4" />
          <circle cx="20" cy="6" r="1.4" />
        </svg>
      )
    case 'geojson':
      return (
        <svg {...iconProps}>
          <path d="M8 3c-2 0-3 1.2-3 3v3c0 1.6-1 2.2-2 2 1 0 2 .4 2 2v3c0 1.8 1 3 3 3" />
          <path d="M16 3c2 0 3 1.2 3 3v3c0 1.6 1 2.2 2 2-1 0-2 .4-2 2v3c0 1.8-1 3-3 3" />
          <circle cx="12" cy="12" r="1.4" />
        </svg>
      )
  }
}
