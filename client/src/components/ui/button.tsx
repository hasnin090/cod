import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transform hover:scale-[1.02] active:scale-[0.98] shadow-md hover:shadow-lg",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-primary-foreground font-semibold hover:brightness-105",
        destructive:
          "bg-gradient-to-r from-[hsl(var(--destructive))] to-rose-600 text-destructive-foreground font-semibold hover:brightness-105",
        outline:
          "border-2 border-input bg-background/90 backdrop-blur-sm hover:bg-accent/40 text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:brightness-105",
        ghost: "hover:bg-gradient-to-r hover:from-sky-100/60 hover:to-sky-200/60 dark:hover:from-slate-700/60 dark:hover:to-slate-800/60 text-slate-700 dark:text-slate-200 shadow-none hover:shadow-md",
        link: "text-[hsl(var(--accent-foreground))] underline-offset-4 hover:underline shadow-none hover:shadow-none transform-none hover:scale-100",
        success: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold hover:brightness-105",
        warning: "bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:brightness-105",
        info: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold hover:brightness-105",
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
