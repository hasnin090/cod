import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-sky-400 to-blue-500 text-white font-semibold hover:from-sky-500 hover:to-blue-600 shadow-sky-400/25 hover:shadow-sky-500/40",
        destructive:
          "bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold hover:from-red-600 hover:to-rose-700 shadow-red-500/25 hover:shadow-red-500/40",
        outline:
          "border-2 border-sky-200 dark:border-sky-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-sky-50 dark:hover:bg-slate-700 hover:border-sky-300 dark:hover:border-sky-600 text-sky-700 dark:text-sky-200",
        secondary:
          "bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-700 dark:text-slate-200 hover:from-slate-200 hover:to-slate-300 dark:hover:from-slate-600 dark:hover:to-slate-700",
        ghost: "hover:bg-gradient-to-r hover:from-sky-100/60 hover:to-sky-200/60 dark:hover:from-slate-700/60 dark:hover:to-slate-800/60 text-slate-700 dark:text-slate-200 shadow-none hover:shadow-md",
        link: "text-sky-600 dark:text-sky-400 underline-offset-4 hover:underline shadow-none hover:shadow-none transform-none hover:scale-100",
        success: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:from-emerald-600 hover:to-teal-700 shadow-emerald-500/25 hover:shadow-emerald-500/40",
        warning: "bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:from-amber-600 hover:to-orange-700 shadow-amber-500/25 hover:shadow-amber-500/40",
        info: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:from-cyan-600 hover:to-blue-700 shadow-cyan-500/25 hover:shadow-cyan-500/40",
      },
      size: {
        default: "h-11 px-6 py-3",
        sm: "h-9 rounded-lg px-4 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-11 w-11 rounded-xl",
        "icon-sm": "h-9 w-9 rounded-lg",
        "icon-lg": "h-12 w-12 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
