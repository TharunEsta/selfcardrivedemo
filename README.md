# Premium Self-Drive Showroom

This project generates four web-ready `.glb` car assets with Blender and presents them in a premium dark automotive configurator built with Three.js.

## Included vehicles

- Toyota Innova Crysta
- Maruti Suzuki Gypsy
- Maruti Suzuki Swift
- Maruti Suzuki Dzire

## Commands

```bash
npm install
npm run generate:cars
npm run dev
```

## Notes

- The Blender generator produces lightweight concept meshes with turntable animation for interactive website use.
- Paint variants are applied in the web viewer, so one `.glb` is exported per vehicle and colorways are switched in the configurator.
- If you need OEM-level body accuracy, panel lines, logos, interiors, or exact trim geometry, the next step is replacing the generated concept meshes with professionally modeled source assets while keeping the same viewer pipeline.
"# selfcardrivedemo" 
