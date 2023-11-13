
"use strict";

const msPerDay      = 24*60*60*1000;
const mjdShift      = 40586;
const fromMJD = mjd => new Date((mjd - mjdShift) * msPerDay);

const fitcolors =
    [ "#428bca",
      "#5cb85c",
      "#5bc0de",
      "#f0ad4e",
      "#d9534f"
    ]

const last = xs => xs[xs.length - 1];

exports._mkSvg = function(elem, dim) {
    return function () {
        const svg = d3.select(elem)
                .append("svg")
                // .classed("svg-content-responsive",true)
                // .attr("viewBox", [0,0,1000, 600])
                .attr("viewBox", [0,0,dim.width, dim.height])
                .style("overflow","visible");
        return { svg: svg, dimensions: dim } ;
    }
}

exports.clearSvg = function(svg) {
    return function () {
        svg.selectAll("*").remove();
    }
}

const timedSeries = series => function(t,keeplast) {
    return series.map(function (s) {
        const cutoff = d3.bisector(p => p.t).right(s.values,t);
        return {
            name: s.name
          , values: s.values.slice(0,cutoff+(keeplast ? 1 : 0))
        };
    }).filter(s => s.values.length > 0);
}

const r2format = d3.format(".3f");
// { axis: {x,y,z,t : { scale : Scale, label : String} }
// , series : [{ name : String, values: [SeriesData]}]
// }
// type SeriesData a b c d =
//     { name      :: String
//     , values    :: Array (Point a b c d)
//     , modelfits :: Array (FitData a b)
//     }
// type ModelRes =
//     { params :: O.Object SomeValue
//     , r2     :: Number
//     }
// type FitData a b =
//     { fit :: ModelFit
//     , info :: O.Object ModelRes
//     , values :: Array (Point2D a b)
//     }
// type FitData a b =
//     { fit :: ModelFit
//     , info :: O.Object ModelRes
//     , values :: Array (Point2D a b)
//     }
exports._drawData = function(handleType, handleScale, handleModelFit, typeX, typeY, typeZ, typeT, svgdat, scatter) {
    const svg = svgdat.svg;
    const width = svgdat.dimensions.width;
    const height = svgdat.dimensions.height;
    // const width = 1000;
    // const height = 600;

    const scaleFunc = scale =>
        handleScale(scale)(
            { date:   (() => d3.scaleUtc())
            , linear: (() => () => d3.scaleLinear())
            , log:    (() => d3.scaleLog())
            , symlog: (() => d3.scaleSymlog())
            }
        );

    const fmt = tp =>
        handleType(tp)(
            // { day:     (() => val => val.toLocaleDateString(undefined, {month:"numeric",day:"numeric"}))
            { day:     (() => d3.timeFormat("%b %d"))
            , days:    (() => d3.format(".3~s"))
            , "int":   (() => d3.format(".3~s"))
            , number:  (() => n => isNaN(n) ? "NaN"
                                 : !isFinite(n) ? "Infinity"
                                 : d3.format(".3~s")(n)
                       )
            , percent: (() => d3.format("+.3~p"))
            }
        )
    const fmtX = fmt(typeX);
    const fmtY = fmt(typeY);
    const fmtZ = fmt(typeZ);
    const fmtT = fmt(typeT);
    const axisTicker = tp =>
        handleType(tp)(
            { day:     (() => (a,n) => a.ticks(n).tickFormat(d3.timeFormat("%b %d")))
            , days:    (() => (a,n) => a.ticks(n ? n : 10, ".3~s"))
            , "int":   (() => (a,n) => a.ticks(n ? n : 10, ".3~s"))
            , number:  (() => (a,n) => a.ticks(n ? n : 10, ".3~s"))
            , percent: (() => (a,n) => a.ticks(n ? n : 10, "+.3~p"))
            }
        );
    const axisTickerX = axisTicker(typeX);
    const axisTickerY = axisTicker(typeY);
    const axisTickerZ = axisTicker(typeZ);
    const axisTickerT = axisTicker(typeT);
    // const fmtSomeVal = sv => sv(tp => x => fmt(tp)(x));
    const fmtSomeVal = sv => sv(tp => x => fmt(tp)(convert(tp)(x)));
// newtype DSum tag f = DSum
//   (forall r. (forall a. tag a -> f a -> r) -> r)

    const validVal = scale => val =>
        !isNaN(val) && handleScale(scale)(
          { date: (() => true)
          , linear: (() => () => true)
          , log: (() => val > 0)
          , symlog: (() => true)
          }
        );
    const validX = validVal(scatter.axis.x.scale);
    const validY = validVal(scatter.axis.y.scale);
    const validZ = validVal(scatter.axis.z.scale);
    const validT = validVal(scatter.axis.t.scale);
    const zeroScale = scale =>
        handleScale(scale)(
          { date: (() => [])
          , linear: (() => zer => zer ? [0] : [])
          , log: (() => [])
          , symlog: (() => [])
          }
        )
    const validPair = function(p) {
        return validX(p.x) && validY(p.y) && validZ(p.z) && validT(p.t);
    }
    const validPair2 = function(p) {
        return validX(p.x) && validY(p.y);
    }
    const convert = tp => val =>
        handleType(tp)(
            { day:     (() => fromMJD(val))
            , days:    (() => val)
            , "int":   (() => val)
            , number:  (() => val)
            , percent: (() => val)
            }
        );
    const convertX = convert(typeX);
    const convertY = convert(typeY);
    const convertZ = convert(typeZ);
    const convertT = convert(typeT);

    const validTimeScale = handleType(typeT)(
            { day: (() => true)
            , days: (() => true)
            , "int": (() => false)
            , number: (() => false)
            , percent: (() => false)
            }
        );

    const modelFitColor = fit => handleModelFit(fit)(
            { linFit: (() => fitcolors[0])
            , expFit: (() => fitcolors[1])
            , logFit: (() => fitcolors[2])
            , decFit: (() => fitcolors[3])
            , quadFit: (() => fitcolors[4])
            }
        );

    const modelFitLabel = fit => handleModelFit(fit)(
            { linFit: (() => "Linear")
            , expFit: (() => "Exp. Growth")
            , logFit: (() => "Logistic")
            , decFit: (() => "Exp. Decay")
            , quadFit: (() => "Quadratic")
            }
        );
    const decorateSeries = ss => ss.map(function(s) {
          const vals = s.values.map( p =>
                      ({ x: convertX(p.x)
                       , y: convertY(p.y)
                       , z: convertZ(p.z)
                       , t: convertT(p.t)
                       , valid: validPair(p)
                      })
                   );
          const segments = d3.pairs(vals);
          const missingDots = [];
          const validSegments = [];
          for (const seg of segments) {
              // console.log(seg);
              if (seg[0].valid) {
                  if (seg[1].valid) {
                      validSegments.push(seg)
                  } else {
                      missingDots.push(seg[0])
                  }
              } else {
                  if (seg[1].valid) {
                      missingDots.push(seg[1]);
                  }
              }
          }
          return { name: s.name
                 , values: vals.filter(d => d.valid)
                 , segments: validSegments
                 , missingDots: missingDots
                 };
      });

    return function () {
        exports.clearSvg(svg)();
        console.log(scatter);
        document.scatter = scatter;
        const margin = { top: 10, right: 40, bottom: 80, left: 50, slider: 35 };
        const series = decorateSeries(scatter.series);
        const fits = scatter.series.flatMap(s =>
            s.modelfits.map(ft =>
                ({ name: s.name
                 , fit: ft.fit
                 , info: ft.info
                 , values: ft.values.map( p =>
                     ({ x: convertX(p.x)
                      , y: convertY(p.y)
                      , valid: validPair2(p)
                     })
                   )
                })
            )
        );
        // console.log(fits);
        const sliceSeries = timedSeries(series);
        // console.log(series);

        const allx = series.flatMap(s => s.values.map(p => p.x) )
                        .concat(fits.flatMap(s => s.values.filter(d=>d.valid).map(p => p.x)));   // include model fits
        const ally = series.flatMap(s => s.values.map(p => p.y) )
                        .concat(fits.flatMap(s => s.values.filter(d=>d.valid).map(p => p.y)));   // include model fits
        const allz = series.flatMap(s => s.values.map(p => p.z) );
        const allt = series.flatMap(s => s.values.map(p => p.t) );
        const extentx = d3.extent(allx.concat(zeroScale(scatter.axis.x.scale)));
        const extenty = d3.extent(ally.concat(zeroScale(scatter.axis.y.scale)));
        const extentz = d3.extent(allz.concat(zeroScale(scatter.axis.z.scale)));
        const extentt = d3.extent(allt.concat(zeroScale(scatter.axis.t.scale)));

        if (allx.length == 0) {
          svg.append("text")
              .attr("text-anchor","middle")
              .attr("x",width/2)
              .attr("y",height/2)
              .attr("fill","#666")
              .attr("font-size",32)
              .text("No data available to plot for this set of projections or regions :(")
          return {
            highlight: (function () { return; }),
            unhighlight: (function () { return; }),
            saveFile: (function () { return false; })
          };
        }

        const svgDefs = svg.append('defs');
        const endlabelGradient = svgDefs.append('linearGradient')
            .attr('id','endlabelGradient');
        endlabelGradient.append('stop')
            .attr('offset',"0%")
            .attr('style',"stop-color:#fff; stop-opacity: 0.5");
        endlabelGradient.append('stop')
            .attr('offset',"50%")
            .attr('style',"stop-color:#fff; stop-opacity: 0.5");
        endlabelGradient.append('stop')
            .attr('offset',"100%")
            .attr('style',"stop-color:#fff; stop-opacity: 0.0");

        // this converts to and form the different coordinate systems
        const x = scaleFunc(scatter.axis.x.scale)
                        .domain(extentx).nice()
                        .range([margin.left, width - margin.right]);
        const y = scaleFunc(scatter.axis.y.scale)
                        .domain(extenty).nice()
                        .range([height - margin.bottom, margin.top]);
        // color
        const z = scaleFunc(scatter.axis.z.scale)
                        .domain(extentz)        // not nice
                        .range([d3.interpolateOranges(0.75),d3.interpolateBlues(0.75)])
                        .interpolate(d3.interpolateCubehelix.gamma(3));
        // legend
        const legdim = { left: 12, top: 55, width: 200 };
        const z_ = scaleFunc(scatter.axis.z.scale)
                        .domain(extentz)
                        .range([0, legdim.width]);
        const t = scaleFunc(scatter.axis.t.scale)
                        .domain(extentt)        // not nice
                        .range([margin.left, width - margin.right]);

        // makes axes lines. i think this converts coordinates into svg points
        // or something???
        const line = d3.line()
                            .x(d => x(d.x))
                            .y(d => y(d.y));
        const line2 = d3.line()
                            .defined(validPair2)
                            .x(d => x(d.x))
                            .y(d => y(d.y));

        // makes axes lines
        const xAxis = function(g) {
            g.attr("transform", `translate(0,${height - margin.bottom})`)
                .call(axisTickerX(d3.axisBottom(x)))
                .call(g => g.append("text")
                            .attr("x", width - margin.right - 4)
                            .attr("y", -5)
                            .attr("fill", "#666")
                            .attr("text-anchor", "end")
                            // .attr("font-weight", "bold")
                            .attr("font-size", 20)
                            .text(scatter.axis.x.label)
                     )
                .call(g => g.selectAll(".tick line").clone()
                            .attr("stroke-opacity", 0.1)
                            .attr("y1", -height + margin.top + margin.bottom)
                     )
        };
        const yAxis = function(g) {
            g.attr("transform", `translate(${margin.left},0)`)
                .call(axisTickerY(d3.axisLeft(y)))
                .call(g => g.selectAll(".tick line").clone()
                                .attr("stroke-opacity", 0.1)
                                .attr("x2", width - margin.left - margin.right)
                     )
                .call(g => g.select(".tick:last-of-type text").clone()
                        .attr("x", 8)
                        .attr("y", 12)
                        .attr("text-anchor", "start")
                        .attr("font-size", 20)
                        .attr("fill", "#666")
                        .text(scatter.axis.y.label)
                    );
        };
        const zLegend = function(g) {
            const segs = d3.pairs(d3.range(33).map(function(x) {
                // between 0 and width
                const xx     = x/32 * legdim.width;
                const xm     = z_.invert(xx);
                const xcolor = z(xm);
                // console.log({ xx: xx, xcolor: xcolor });
                return { xx: xx, xcolor: xcolor }
              }));
            g.attr("transform", `translate(${margin.left + legdim.left},${margin.top + legdim.top})`)
                .call(axisTickerZ(d3.axisBottom(z_),4))
                .call(g => g.append("g")
                            .attr("stroke-width",10)
                            .attr("fill","none")
                            .selectAll("line")
                            .data(segs)
                            .join("line")
                            .attr("x1", d => d[0].xx)
                            .attr("x2", d => d[1].xx+1)
                            .attr("y1", -4.5)
                            .attr("y2", -4.5)
                            .attr("stroke", d => d[0].xcolor)
                        )
                .call(g => g.append("text")
                        .attr("x",0)
                        .attr("y",-12.5)
                        .attr("text-anchor", "start")
                        .attr("font-weight", "bold")
                        .attr("font-size", 12)
                        .attr("fill","currentColor")
                        .text(scatter.axis.z.label)
                    );
        }
        const tAxis = function(g) {
            const sliderino = d3.sliderBottom(t)
                        .tickFormat(fmtT)
                        .displayFormat(fmtT)
            g.attr("transform", `translate(0,${height - margin.slider})`)
                .call(sliderino)
                .append("text")
                .attr("x", margin.left-5)
                .attr("y", -10)
                .attr("fill", "currentColor")
                .attr("font-weight", "bold")
                .attr("font-size", 12)
                .text(scatter.axis.t.label);
            return sliderino;
        }

        const highlight = datalines => function(name) {
          datalines.selectAll("path").attr("stroke-width", d => d.name === name ? 3 : 1);
          datalines.selectAll("circle").attr("r", d => d.name === name ? 3.1 : 1.1);
        }
        const unhighlight = datalines => function() {
          datalines.selectAll("path").attr("stroke-width",2);
          datalines.selectAll("circle").attr("r",2.1);
        }

        // quadtree points for fits
        const quadFitsPoints = fits.flatMap(s =>
            s.values.map(p => ({ x: x(p.x), y: y(p.y), name: s.name, fit: s.fit, info: s.info }))
        );

        // make quadtree points for non-model points
        const mkQuadPoints = ss => ss.flatMap(s =>
              s.values.map(p => ({ x: x(p.x), y: y(p.y), z: p.z, t: p.t, name: s.name }))
            );

        var currQuadPoints = mkQuadPoints(series);
        // quadtree to look up nearest point. note z is not encoded
        const quadtree = d3.quadtree()
                .x(d => d.x)
                .y(d => d.y)
                // .extent([x(extentx[0]),y(extenty[0])], [x(extentx[1]),y(extenty[1])])
                .addAll(quadFitsPoints)
                .addAll(currQuadPoints);

        const requad = function(t_) {
            quadtree.removeAll(currQuadPoints);
            currQuadPoints = mkQuadPoints(sliceSeries(t_, t_ == extentt[1]));
            quadtree.addAll(currQuadPoints);
        }

        const hover = function(svg, highlight, unhighlight) {

          if ("ontouchstart" in document) svg
              .style("-webkit-tap-highlight-color", "transparent")
              .on("touchmove", moved)
              .on("touchstart", entered)
              .on("touchend", left)
          else svg
              .on("mousemove", moved)
              .on("mouseenter", entered)
              .on("mouseleave", left);

          const crosshair = svg.append("g").attr("display", "none");

          const ch_center = crosshair.append("circle")
                    .attr("stroke","steelblue")
                    .attr("stroke-width",2);

          const mkLabel = (g,anchor,fsize,x,y) => g.append("text")
              .attr("font-family", "sans-serif")
              .attr("font-size", fsize)
              .attr("text-anchor",anchor)
              .attr("x",x)
              .attr("y",y);

          const syncDots = crosshair.append("g");

          const tooltip = crosshair.append("g")
                                .style("opacity",0.85)
                                .attr("display","none");

          tooltip.append("rect")
              .attr("width",100)
              .attr("height",50)
              .attr("x",-110)
              .attr("y",-60)
              .style("fill","#fff")
              .style("stroke","#666")
              .style("stroke-width","1px")

          const bottomlabel = mkLabel(tooltip,"middle",12,-60, -44)
                                    .attr("font-weight","bold");
          const toplabel    = mkLabel(tooltip,"middle",10,-60, -28);
          const footlabel   = mkLabel(tooltip,"middle",9,-60, -16);

          const modeltip = svg.append("g")
                                .style("opacity",0.85);

          modeltip.append("rect")
                    .attr("width",125)
                    .attr("height",150)
                    .attr("x",margin.left+10)
                    .attr("y",margin.top+legdim.top+25)
                    .style("fill","#fff")
                    .style("stroke","#666")
                    .style("stroke-width","1px")
          modeltip.attr("display","none");

          const vertline = crosshair.append("line")
                .style("stroke-width",0.5)
                .style("stroke-dasharray","4 4")
                .style("stroke","#777")
                .style("fill","none");

          const horizline = crosshair.append("line")
                .style("stroke-width",0.5)
                .style("stroke-dasharray","4 4")
                .style("stroke","#777")
                .style("fill","none");

          const colorline = crosshair.append("line")
                .style("stroke-width",8)
                .style("stroke","#fff")
                .style("fill","none")
                .attr("y1", -5.5)
                .attr("y2", 5.5);
          const colorcenter = crosshair.append("line")
              .style("stroke-width",2)
              .attr("fill","none")
              .attr("y1", -7)
              .attr("y2", 7);


          function moved() {
            d3.event.preventDefault();
            const mouse0 = d3.mouse(this);
            if (mouse0[1] > height-margin.bottom) {
                left();
                return;
            } else {
                entered();
                tooltip.attr("display",null);
            }
            const mouse = [Math.max(margin.left,Math.min(width-margin.right,mouse0[0])),
                           Math.max(margin.top,Math.min(height-margin.bottom,mouse0[1]))
                          ];

            const closest = quadtree.find(mouse[0], mouse[1], 67);


            const foundPoint = !(closest === undefined);
            // i wish i had ADTs lol
            const closestType = foundPoint ? (closest.fit ? "fit" : "point") : null;
            const xc = foundPoint ? closest.x : mouse[0];
            const yc = foundPoint ? closest.y : mouse[1];
            const xm = x.invert(xc);
            const ym = y.invert(yc);

            crosshair.attr("transform", `translate(${xc},${yc})`);
            vertline.attr("y1", -yc+margin.top).attr("y2", -yc+height-margin.bottom);
            horizline.attr("x1", -xc+margin.left).attr("x2", -xc+width-margin.right);
            syncDots.selectAll("*").remove();

            const showx = fmtX(xm);
            const showy = fmtY(ym);
            toplabel.text(showx + ", " + showy);

            if (foundPoint) {

              highlight(closest.name);
              bottomlabel.text(closest.name);
              toplabel
                  .attr("font-size",10)
                  .attr("y",-28);
              modeltip.attr("display","none");

              if (closestType == "point") {
                ch_center.attr("fill",z(closest.z))
                         .on("click",null)
                         .on("click", function() {
                             moveSetSlider(closest.t);
                             play_stop();
                          })
                         .attr("cursor","pointer")
                         .attr("r",6.0)
                ch_center.selectAll("title").remove()
                ch_center.append("title").text("Jump to time " + fmtT(closest.t));

                footlabel.text(
                      [fmtZ(closest.z),fmtT(closest.t)]
                                      .filter(st => st !== showx && st !== showy)
                                      .join(", ")
                  );

                const zloc = z_(closest.z) + legdim.left + margin.left;
                colorline.attr("display", null);
                colorcenter.attr("display", null);
                colorline
                    .attr("transform",`translate(${-xc+zloc},${-yc+margin.top+legdim.top-4.5})`);
                colorcenter
                    .attr("transform",`translate(${-xc+zloc},${-yc+margin.top+legdim.top-4.5})`)
                    .attr("stroke",z(closest.z));

                const syncDotData = series.flatMap(function(s) {
                  const cutoff = d3.bisector(p => p.t).right(s.values,closest.t);
                  const foundval = s.values[Math.min(cutoff-1,s.values.length-1)];
                  // console.log(foundval.t, closest.t, foundval.t === closest.t);
                  if (cutoff == 0 || s.name == closest.name || !(fmtT(foundval.t) === fmtT(closest.t))) {
                      return [];
                  } else {
                      return [foundval];
                  }
                });
                if (validTimeScale) {
                  syncDots.append("g")
                      .selectAll("circle")
                      .data(syncDotData)
                      .join("circle")
                      .attr("r", 3)
                      .attr("stroke",d => z(d.z))
                      .attr("stroke-width",2)
                      .attr("fill",null)
                      .attr("fill-opacity","0")
                      .attr("transform", d => `translate(${x(d.x)-xc},${y(d.y)-yc})`)
                      .style('pointer-events','none')
                }
              } else {
                modeltip.attr("display",null);
                ch_center.attr("fill","white")
                         .on("click",null)
                         .attr("cursor",null)
                         .attr("r",5.0);
                ch_center.selectAll("title").remove()
                colorline.attr("display", "none");
                colorcenter.attr("display", "none");
                var r2sum   = 0;
                var r2count = 0;
                for (const infoname in closest.info) {
                    const infor2 = closest.info[infoname].r2;
                    r2sum   += infor2 * infor2;
                    r2count += 1;
                }
                const r2str = r2format(Math.sqrt(r2sum/r2count));
                footlabel.text(modelFitLabel(closest.fit) + " (r²=" + r2str + ")");
 
                // generate modeltip
                modeltip.selectAll("text").remove();
                const modellinex = margin.left + 10 + 5;
                const modelliney = margin.top + legdim.top + 35 + 5;
                modeltip.append("text")
                    .text(modelFitLabel(closest.fit) + " Fit")
                    .attr("font-size",12)
                    .attr("font-weight","bold")
                    .attr("x",modellinex)
                    .attr("y",modelliney);
                modeltip.append("text")
                    .text(closest.name)
                    .attr("font-size",12)
                    .attr("x",modellinex)
                    .attr("y",modelliney+13);
                var curry = modelliney + 30;
                for (const infoname in closest.info) {
                    const info = closest.info[infoname];
                    modeltip.append("text")
                        .text(infoname)
                        .attr("font-size",10)
                        .attr("font-weight","bold")
                        .attr("x",modellinex)
                        .attr("y",curry);
                    curry += 12;
                    modeltip.append("text")
                        .text("r² = " + r2format(info.r2))
                        .attr("font-size",10)
                        .attr("font-style","italic")
                        .attr("x",modellinex)
                        .attr("y",curry);
                    curry += 12;
                    for (const paramname in info.params) {
                        const param = info.params[paramname];
                        modeltip.append("text")
                            .text(paramname + ": " + fmtSomeVal(param))
                            .attr("font-size",10)
                            .attr("x",modellinex)
                            .attr("y",curry);
                        curry += 12;
                    }
                    curry += 4;
                }
                // console.log(curry);
                modeltip.selectAll("rect")
                    .attr("height",curry + 10 - 4 - modelliney);
              }
            } else {
              toplabel
                .attr("font-size",12)
                .attr("y",-31);
              modeltip.attr("display","none");
              colorline.attr("display", "none");
              colorcenter.attr("display", "none");
              ch_center.attr("r",4.0)
                       .attr("fill","white")
                       .attr("cursor",null);
              ch_center.selectAll("title").remove()
              unhighlight();
              bottomlabel.text("");
              footlabel.text("");
            }

          }

          function entered() {
            crosshair.attr("display", null);
          }

          function left() {
            unhighlight();
            crosshair.attr("display", "none");
            modeltip.attr("display","none");
          }

        }

        const flatSegments = ss => ss.flatMap(s => s.segments.map (p => ({ name: s.name, pair: p })));
        const flatDots = ss => ss.flatMap(s => s.missingDots.map(p => ({ name: s.name, point: p })));
        // const mkTimed = timedSeries(series);

        const mainplot = svg.append("g")
        mainplot.attr("id","mainplot");

        mainplot.append("g")
            .call(xAxis);
        mainplot.append("g")
            .call(yAxis);
        mainplot.append("g")
            .call(zLegend);

        const subplot = mainplot.append("g")
        const endDots = mainplot.append("g");

        // model lines
        subplot.append("g")
            .selectAll("path")
            .data(fits)
            .join("path")
            .attr("fill","none")
            .attr("stroke-width",1.5)
            .attr("stroke-dasharray",[8, 6])
            // .attr("stroke","#595")
            .attr("stroke", d => modelFitColor(d.fit))
            .attr("d", d => line2(d.values));

        // yo this is it
        //
        // i tried using lines here instead of a path but it was slower for
        // some reason, who knew
        const datalines = subplot.append("g");
        const colors = ["#eb4034", "#eba834", "#80eb34", "#34ebe2", "#3486eb", "#6e34eb", "#b734eb", "#eb34c9", "#eb3468"];
        var sumstat = d3.nest() // nest function allows to group the calculation per level of a factor
            .key(function(d) { return d.name;})
            .entries(flatSegments(series));
        var res = sumstat.map(function(d){ return d.key });
        var new_color = d3.scaleOrdinal().domain(res).range(colors);

        datalines
             .selectAll("g")
             .data(flatSegments(series))
             .join("g")
             .append("path")
             .attr("fill", "none")
             .attr("stroke-width", 2)
             .attr("stroke-linejoin", "round")
             .attr("stroke-linecap", "round")
             .attr("stroke", d => new_color(d.name))
             .attr("d", d => line(d.pair))
             .attr("opacity",0)
             .transition()
             .delay(d => t(d.pair[0].t)*0.33)
             .duration(333)
             .attr("opacity",1);
        datalines
            .selectAll("circle")
            .data(flatDots(series))
            .join("circle")
            .attr("r",2.1)
            .attr("fill",d => z(d.point.z))
            .attr("transform", d => `translate(${x(d.point.x)},${y(d.point.y)})`)
            .attr("opacity",0)
            .transition()
            .delay(d => t(d.point.t)*0.33)
            .duration(333)
            .attr("opacity",1);

        svg.call(hover, highlight(datalines),unhighlight(datalines));


        const setTime = function(subplot, t_) {
            if (validTimeScale) {
              subplot.selectAll("path")
                  .attr("display", d => (d.pair[0].t < t_) ? null : "none")
                  .attr("stroke-dasharray", function (d) {
                      if (d.pair[0].t < t_ && d.pair[1].t > t_) {
                          const dx = x(d.pair[1].x) - x(d.pair[0].x);
                          const dy = y(d.pair[1].y) - y(d.pair[0].y);
                          const dist = Math.sqrt( dx*dx + dy*dy );
                          const timeScaled = (t(t_) - t(d.pair[0].t)) / (t(d.pair[1].t) - t(d.pair[0].t));
                          return `${dist*timeScaled},${dist}`
                      } else {
                          return null;
                      }
                  });
              subplot.selectAll("circle")
                  .attr("display", d => (d.point.t < t_) ? null : "none");
            }

            endDots.selectAll("*").remove();

            const dotData = series.flatMap(function(s) {
              if (validTimeScale) {
                  const cutoff = d3.bisector(p => p.t).right(s.values,t_);
                  if (cutoff == 0) {
                      return [];
                  } else if (cutoff >= s.values.length) {
                      return [{
                          name: s.name
                        , last: last(s.values)
                      }];
                  } else {
                      const here = s.values[cutoff-1];
                      const lastMissing = d3.bisector(p => p.t).right(s.missingDots,t_);
                      const there = s.values[cutoff];
                      const freeze = s.missingDots[lastMissing-1]
                                  && s.missingDots[lastMissing]
                                  && fmtT(s.missingDots[lastMissing-1].t) === fmtT(here.t)
                                  && fmtT(s.missingDots[lastMissing].t) === fmtT(there.t);
                      if (freeze) {
                        return [{
                            name: s.name
                          , last: here
                        }]
                      } else {
                        const there = s.values[cutoff];
                        const interp = d3.interpolate(here, there);
                        const timeScaled = (t(t_) - t(here.t)) / (t(there.t) - t(here.t));
                        return [{
                            name: s.name
                          , last: interp(timeScaled)
                        }]
                      }
                  }
              } else {
                  if (s.values.length > 0) {
                      return [{name: s.name, last: last(s.values)}];
                  } else {
                      return [];
                  }
              }
            });

            const endSlots = endDots.append("g")
                .selectAll("g")
                .data(dotData)
                .join("g");

            endSlots.append("rect")
                .attr("width",60)
                .attr("height",14)
                .attr("style","fill:url(#endlabelGradient)")
                .attr("x",d => x(d.last.x)+10)
                .attr("y",d => y(d.last.y)-8);

            endSlots.append("text")
                .attr("text-anchor","start")
                .attr("x",d => x(d.last.x)+10)
                .attr("y",d => y(d.last.y)+3)
                .attr("font-family", "sans-serif")
                .attr("font-size", 12)
                .text(d => d.name)
                .style('pointer-events','none');

            endDots.append("g")
                .selectAll("circle")
                .data(dotData)
                .join("circle")
                .attr("r", 3)
                .attr("fill","red")
                .attr("transform", d => `translate(${x(d.last.x)},${y(d.last.y)})`)
                .style('pointer-events','none')

            requad(t_);
        }

        const subslider = svg.append("g");
        const sliderino = tAxis(subslider.append("g"))
                // .on('onchange', v => setTime(subplot,v))
                .on('onchange', _.throttle(v => setTime(datalines,v), 50))
                // .on('end',v => requad(v));

        const button = svg.append("g")
                    .attr("transform",`translate(0,${height-margin.slider-15})`)
                    .style("cursor", validTimeScale ? "pointer" : "not-allowed")
                    .style('pointer-events','all');

        const drawButton = function(g,isPlaying,callback,velocity) {
            g.selectAll("*").remove();
            g.on("click",null)
                .on("click",callback);
            g.append("rect")
                .attr("width",30)
                .attr("height",30)
                .attr("rx",3)
                .style("fill",validTimeScale ? d3.schemeDark2[1] : "#999")
                .append("title")
                .text(isPlaying && velocity == 2 ? "Pause" : (velocity == 1 ? "Play faster" : "Play"));
            if (isPlaying && velocity == 2) {
                g.append("rect")
                    .attr("width",6)
                    .attr("height",18)
                    .attr("x",6)
                    .attr("y",6)
                    .attr("rx",1)
                    .style("fill","white")
                    .append("title")
                    .text("Pause");
                g.append("rect")
                    .attr("width",6)
                    .attr("height",18)
                    .attr("x",18)
                    .attr("y",6)
                    .attr("rx",1)
                    .style("fill","white")
                    .append("title")
                    .text("Pause");
            } else if(velocity == 1){
                g.append("path")
                    .attr("d","M9 6 L9 24 L21 15 Z M15 6 L15 24 L27 15 Z")
                    .style("fill","white")
                    .append("title")
                    .text("Play faster");
            }
            else {
                g.append("path")
                    .attr("d","M9 6 L9 24 L21 15 Z")
                    .style("fill","white")
                    .append("title")
                    .text("Play");
            }
        }


        const moveSetSlider = function(t) {
            sliderino.value(t);
            setTime(datalines,t);
            resting = t == extentt[1];
        }

        var timer = null;
        var resting = true;

        const playdata = (function () {
            const playtime = 15000;
            const delay = 200;
            const numSteps = playtime / delay;
            const minT = t(extentt[0])
            const maxT = t(extentt[1])
            const domainwidth = maxT - minT;
            const stepAmt = domainwidth / numSteps;
            return {
                minT: minT,
                maxT: maxT,
                delay: delay,
                stepAmt: stepAmt
            };
        })();

        const play_start = function () {
            button.call(drawButton,true,play_faster,1);
            timer = setInterval(play_tick,playdata.delay);
        }
        const play_faster = function () {
            button.call(drawButton,true,play_stop,2);
            clearInterval(timer);
            timer = null;
            timer = setInterval(play_tick,playdata.delay/2);
        }
        const play_stop = function () {
            button.call(drawButton,false,play_start,0);
            clearInterval(timer);
            timer = null;
        }
        const play_tick = function () {
            const currval = t(sliderino.value());
            const nextval = currval + playdata.stepAmt;
            const hitTheEnd = nextval > playdata.maxT;
            if (hitTheEnd) {
                if (resting) {
                    moveSetSlider(extentt[0]);
                } else {
                    resting = true;
                    moveSetSlider(extentt[1]);
                    return play_stop();
                }
            } else {
                moveSetSlider(t.invert(nextval));
            }
        }

        // window.sliderino = sliderino;
        // window.tt = t;

        button.call(drawButton,false,play_start,0);

        moveSetSlider(extentt[1]);

        if (!validTimeScale) {
            subslider.attr("display","none");
            svg.append("text")
                .attr("fill","none")
                .attr("x",margin.left-5)
                .attr("y", height-margin.slider+5)
                .attr("fill", "currentColor")
                .attr("font-style", "italic")
                .attr("font-size", 14)
                .text("(Time controls disabled for non-time axis)");
        }

        const saveFile = function (fname) {
            saveSvgAsPng(mainplot._groups[0][0], fname);
            return true;
        }


        window.subplot = subplot;
        return {
            highlight: highlight(datalines),
            unhighlight: unhighlight(datalines),
            // settime: (v => setTime(subPlot, v)),
            saveFile: saveFile
        };
    }
}



// takes a (maybe string)
exports._highlight = function(handleMaybe,interactors,name) {
    return function() {
        handleMaybe(name)(
            { nothing: (() => interactors.unhighlight())
            , just: (n => interactors.highlight(n))
            }
        );
    }
}

// takes a filename
exports._saveFile = function(interactors, fn) {
    return function() {
        return interactors.saveFile(fn);
    }
}
