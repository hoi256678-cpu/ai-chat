# Third-party notices

## Body diagram outline (`components/BodyDiagram.tsx`)

The SVG region paths used in the symptom-check body diagram are adapted
from the MoleMapper body map:

- Source: https://github.com/etal/bodymap
  (`maps/molemapper/molemapper.plain.svg`)
- Copyright (c) 2017 University of California, San Francisco
- Copyright (c) 2017 Eric Talevich
- Copyright (c) 2017 Daniel Webster
- Licensed under the Apache License, Version 2.0
  (http://www.apache.org/licenses/LICENSE-2.0)

Changes made: fill/stroke styling replaced with this app's own pastel
theme tokens; the ~60 fine-grained anatomical regions per view were
grouped onto this app's existing Korean symptom categories; the
tap-to-select and pain-marker interaction is new and not part of the
original work.
