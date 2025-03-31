document.addEventListener('DOMContentLoaded', function() {
    const params = {
        lambda: 380e-9,  
        a: 97e-6,        
        b: 97e-6,        
        R: 53e-6,       
        D: 200e-6,       
        L: 1.046         
    };
    
    const aperturesCanvas = document.getElementById('aperturesCanvas');
    const aperturesCtx = aperturesCanvas.getContext('2d');
    const diffractionCanvas = document.getElementById('diffractionCanvas');
    const diffractionCtx = diffractionCanvas.getContext('2d');
    let intensityChart = null;
    
    const sliders = {
        a: document.getElementById('slider-a'),
        b: document.getElementById('slider-b'),
        R: document.getElementById('slider-R'),
        D: document.getElementById('slider-D'),
        lambda: document.getElementById('slider-lambda'),
        L: document.getElementById('slider-L')
    };
    
    const sliderValues = {
        a: document.getElementById('value-a'),
        b: document.getElementById('value-b'),
        R: document.getElementById('value-R'),
        D: document.getElementById('value-D'),
        lambda: document.getElementById('value-lambda'),
        L: document.getElementById('value-L')
    };
    
    const mainTitle = document.getElementById('mainTitle');
    const farFieldMessage = document.getElementById('farFieldMessage');
    const apertureType = document.getElementById('apertureType');
    
    function wavelengthToRGB(wavelength) {
        wavelength = wavelength * 1e9;
        
        let r = 0, g = 0, b = 0;
        let factor = 1;
        
        if (wavelength < 380) {
            return [0, 0, 0];
        } else if (wavelength < 440) {
            r = -(wavelength - 440) / (440 - 380);
            g = 0.0;
            b = 1.0;
        } else if (wavelength < 490) {
            r = 0.0;
            g = (wavelength - 440) / (490 - 440);
            b = 1.0;
        } else if (wavelength < 510) {
            r = 0.0;
            g = 1.0;
            b = -(wavelength - 510) / (510 - 490);
        } else if (wavelength < 580) {
            r = (wavelength - 510) / (580 - 510);
            g = 1.0;
            b = 0.0;
        } else if (wavelength < 645) {
            r = 1.0;
            g = -(wavelength - 645) / (645 - 580);
            b = 0.0;
        } else if (wavelength <= 780) {
            r = 1.0;
            g = 0.0;
            b = 0.0;
        } else {
            return [0, 0, 0];
        }
        
        if (wavelength < 420) {
            factor = 0.3 + 0.7 * (wavelength - 380) / (420 - 380);
        } else if (wavelength > 700) {
            factor = 0.3 + 0.7 * (780 - wavelength) / (780 - 700);
        }
        
        r = Math.max(r * factor, 0);
        g = Math.max(g * factor, 0);
        b = Math.max(b * factor, 0);
        
        const maxVal = Math.max(r, g, b);
        if (maxVal > 0) {
            r = r / maxVal;
            g = g / maxVal;
            b = b / maxVal;
        }
        
        return [r, g, b];
    }
    
    function sinc(x) {
        return (Math.abs(x) < 1e-10) ? 1.0 : Math.sin(x) / x;
    }
    
    function besselJ1(x) {
        if (Math.abs(x) < 1e-10) {
            return 0.5;
        }
        
        try {
            return math.besselJ(1, x);
        } catch (error) {
            console.error("Error en función de Bessel:", error);
            if (Math.abs(x) < 3.0) {
                return 0.5 * x - 0.0625 * Math.pow(x, 3);
            } else {
                return Math.sqrt(2 / (Math.PI * x)) * 
                      Math.cos(x - 3 * Math.PI / 4);
            }
        }
    }
    
    function calculateIntensityAtPoint(x, y, params) {
        const k = 2 * Math.PI / params.lambda;
        const kx = k * x / params.L;
        const ky = k * y / params.L;
        
        const rectExists = params.a > 1e-10 && params.b > 1e-10;
        const circExists = params.R > 1e-10;
        
        let rectTerm = 0;
        let circTerm = 0;
        let interference = 0;
        
        if (rectExists) {
            const sincX = sinc(kx * params.a / 2);
            const sincY = sinc(ky * params.b / 2);
            rectTerm = Math.pow(sincX * sincY, 2);
        }
        
        if (circExists) {
            const rXY = Math.sqrt(x * x + y * y);
            const argBessel = k * params.R * rXY / params.L;
            const besselTerm = (Math.abs(argBessel) < 1e-10) ? 1.0 : 
                              (2 * besselJ1(argBessel) / argBessel);
            circTerm = Math.pow(besselTerm, 2);
        }
        
        if (rectExists && circExists) {
            const sincX = sinc(kx * params.a / 2);
            const sincY = sinc(ky * params.b / 2);
            
            const rXY = Math.sqrt(x * x + y * y);
            const argBessel = k * params.R * rXY / params.L;
            const besselTerm = (Math.abs(argBessel) < 1e-10) ? 1.0 : 
                              (besselJ1(argBessel) / argBessel);
            
            interference = 2 * (sincX * sincY) * besselTerm * Math.cos(k * params.D * x / params.L);
        }
        
        const intensity = rectTerm + circTerm + interference;
        return isNaN(intensity) || !isFinite(intensity) ? 0 : intensity;
    }
    
    function generateDiffractionPattern(size, points, params) {
        const data = {
            intensities: [],
            max: 0,
            min: Infinity,
            x: [],
            y: []
        };
        
        const step = 2 * size / (points - 1);
        
        for (let i = 0; i < points; i++) {
            data.y.push(-size + i * step);
        }
        
        for (let i = 0; i < points; i++) {
            data.x.push(-size + i * step);
        }
        
        for (let i = 0; i < points; i++) {
            const row = [];
            for (let j = 0; j < points; j++) {
                const intensity = calculateIntensityAtPoint(data.x[j], data.y[i], params);
                row.push(intensity);
                if (intensity > data.max) {
                    data.max = intensity;
                }
                if (intensity < data.min && intensity > 0) {
                    data.min = intensity;
                }
            }
            data.intensities.push(row);
        }
        
        if (data.max <= 0) {
            data.max = 1;
        }
        if (data.min === Infinity) {
            data.min = 0;
        }
        
        return data;
    }
    
    function drawApertures() {
        const { a, b, R, D } = params;
        
        const rectExists = a > 1e-10 && b > 1e-10;
        const circExists = R > 1e-10;
        
        const maxDim = Math.max(
            rectExists ? a : 0,
            rectExists ? b : 0,
            circExists ? R * 2 : 0,  
            (rectExists && circExists) ? D + a/2 + R : 1e-5
        );
        const scale = (maxDim > 1e-10) ? maxDim * 1.5 : 1e-4;
        
        aperturesCtx.clearRect(0, 0, aperturesCanvas.width, aperturesCanvas.height);
        aperturesCtx.fillStyle = 'black';
        aperturesCtx.fillRect(0, 0, aperturesCanvas.width, aperturesCanvas.height);
        
        const mapX = (x) => aperturesCanvas.width / 2 + (x / scale) * (aperturesCanvas.width / 2);
        const mapY = (y) => aperturesCanvas.height / 2 - (y / scale) * (aperturesCanvas.height / 2);
        
        if (rectExists) {
            const rectX = -D / 2 - a / 2;
            const rectY = -b / 2;
            
            aperturesCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            aperturesCtx.strokeStyle = 'blue';
            aperturesCtx.lineWidth = 2;
            
            aperturesCtx.beginPath();
            aperturesCtx.rect(
                mapX(rectX),
                mapY(rectY),
                (a / scale) * aperturesCanvas.width / 2,
                (b / scale) * aperturesCanvas.height / 2
            );
            aperturesCtx.fill();
            aperturesCtx.stroke();
        }
        
        if (circExists) {
            const centerX = D / 2;
            
            aperturesCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            aperturesCtx.strokeStyle = 'cyan';
            aperturesCtx.lineWidth = 2;
            
            aperturesCtx.beginPath();
            aperturesCtx.arc(
                mapX(centerX),
                mapY(0),
                (R / scale) * aperturesCanvas.width / 2,
                0,
                2 * Math.PI
            );
            aperturesCtx.fill();
            aperturesCtx.stroke();
        }
        
        aperturesCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        aperturesCtx.lineWidth = 1;
        
        aperturesCtx.beginPath();
        aperturesCtx.moveTo(0, aperturesCanvas.height / 2);
        aperturesCtx.lineTo(aperturesCanvas.width, aperturesCanvas.height / 2);
        aperturesCtx.stroke();
        
        aperturesCtx.beginPath();
        aperturesCtx.moveTo(aperturesCanvas.width / 2, 0);
        aperturesCtx.lineTo(aperturesCanvas.width / 2, aperturesCanvas.height);
        aperturesCtx.stroke();
    }
    
    function drawDiffractionPattern() {
        const { lambda } = params;
        
        const data = generateDiffractionPattern(5e-3, 200, params);
        
        const patronValido = data.max > 0;
        
        diffractionCtx.clearRect(0, 0, diffractionCanvas.width, diffractionCanvas.height);
        diffractionCtx.fillStyle = 'black';
        diffractionCtx.fillRect(0, 0, diffractionCanvas.width, diffractionCanvas.height);
        
        if (!patronValido) {
            diffractionCtx.fillStyle = 'white';
            diffractionCtx.font = '16px Arial';
            diffractionCtx.textAlign = 'center';
            diffractionCtx.fillText("No hay aberturas válidas", diffractionCanvas.width / 2, diffractionCanvas.height / 2);
            diffractionCtx.fillText("(dimensiones nulas)", diffractionCanvas.width / 2, diffractionCanvas.height / 2 + 30);
            return;
        }
        
        const imageData = diffractionCtx.createImageData(data.intensities[0].length, data.intensities.length);
        const rgbColor = wavelengthToRGB(lambda);
        
        const factorLog = 0.001;
        
        for (let i = 0; i < data.intensities.length; i++) {
            for (let j = 0; j < data.intensities[i].length; j++) {
                const intensity = data.intensities[i][j] / data.max;
                
                const logIntensity = Math.log1p(intensity / factorLog) / Math.log1p(1 / factorLog);
                
                const idx = (i * data.intensities[i].length + j) * 4;
                imageData.data[idx] = logIntensity * rgbColor[0] * 255;     
                imageData.data[idx + 1] = logIntensity * rgbColor[1] * 255; 
                imageData.data[idx + 2] = logIntensity * rgbColor[2] * 255; 
                imageData.data[idx + 3] = 255;                              
            }
        }
        
        diffractionCtx.putImageData(imageData, 0, 0);
        
        updateIntensityProfile(data);
    }
    
    function updateIntensityProfile(data) {
        const centerY = Math.floor(data.intensities.length / 2);
        const profile = data.intensities[centerY].map(i => i / data.max);
        
        const xValues = data.x.map(x => x * 1000);  // Convertir metros a milímetros
        
        const chartData = {
            labels: xValues,
            datasets: [{
                label: 'Intensidad',
                data: profile.map((y, i) => ({ x: xValues[i], y: isNaN(y) ? 0 : y })),
                borderColor: 'white',
                backgroundColor: getRGBAColorString(wavelengthToRGB(params.lambda), 0.5),
                borderWidth: 1.5,
                fill: true,
                tension: 0.1
            }]
        };
        
        function getRGBAColorString(rgb, alpha) {
            return `rgba(${Math.round(rgb[0] * 255)}, ${Math.round(rgb[1] * 255)}, ${Math.round(rgb[2] * 255)}, ${alpha})`;
        }
        
        if (intensityChart) {
            intensityChart.data = chartData;
            intensityChart.update();
        } else {
            const ctx = document.getElementById('intensityChart').getContext('2d');
            intensityChart = new Chart(ctx, {
                type: 'line',
                data: chartData,
                options: {
                    responsive: true,
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            title: {
                                display: true,
                                text: 'X (mm)',
                                color: 'white'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'white'
                            }
                        },
                        y: {
                            min: 0,
                            max: 1.05,
                            title: {
                                display: true,
                                text: 'Intensidad Normalizada',
                                color: 'white'
                            },
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'white'
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Interferencia modulada por difracción',
                            color: 'white',
                            font: {
                                size: 16
                            }
                        },
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Intensidad: ${context.parsed.y.toFixed(4)}`;
                                }
                            }
                        }
                    },
                    animation: {
                        duration: 0
                    }
                }
            });
        }
    }
    
    function updateInfo() {
        const { a, b, R, D, lambda, L } = params;
        
        const rectExists = a > 1e-10 && b > 1e-10;
        const circExists = R > 1e-10;
        
        const calcA = rectExists ? a : 1e-10;
        const calcB = rectExists ? b : 1e-10;
        const calcR = circExists ? R : 1e-10;
        
        let descAberturas;
        if (rectExists && circExists) {
            descAberturas = "Ambas aberturas";
        } else if (rectExists) {
            descAberturas = "Solo abertura rectangular";
        } else if (circExists) {
            descAberturas = "Solo abertura circular";
        } else {
            descAberturas = "Sin aberturas";
        }
        
        mainTitle.textContent = `Difracción de Fraunhofer: ${descAberturas} (λ = ${(lambda * 1e9).toFixed(0)} nm)`;
        
        apertureType.textContent = descAberturas;
        
        const campoLejanoLimite = (calcA**2 + calcB**2 + calcR**2) / lambda;
        const campoLejano = L > campoLejanoLimite;
        
        let mensaje = "CONDICIÓN DE CAMPO LEJANO: ";
        if (!rectExists && !circExists) {
            mensaje += "N/A (Sin aberturas)";
            farFieldMessage.className = "message-box message-neutral";
        } else if (campoLejano) {
            mensaje += "CUMPLIDA";
            farFieldMessage.className = "message-box message-success";
        } else {
            mensaje += "NO CUMPLIDA";
            farFieldMessage.className = "message-box message-error";
        }
        
        mensaje += `\n${descAberturas}\nD' = ${L.toFixed(3)} m >> ${campoLejanoLimite.toFixed(6)} m`;
        farFieldMessage.textContent = mensaje;
    }
    
    function updateSimulation() {
        try {
            drawApertures();
            drawDiffractionPattern();
            updateInfo();
        } catch (error) {
            console.error("Error en la simulación:", error);
            alert("Ocurrió un error al actualizar la simulación. Por favor, revise los valores de los parámetros.");
        }
    }
    
    function formatLength(value) {
        if (value < 1e-3) {
            return `${(value * 1e6).toFixed(1)} μm`;
        } else {
            return `${value.toFixed(3)} m`;
        }
    }
    
    function formatWavelength(value) {
        return `${(value * 1e9).toFixed(0)} nm`;
    }
    
    for (const key in sliders) {
        sliders[key].addEventListener('input', function() {
            params[key] = parseFloat(this.value);
            
            if (key === 'lambda') {
                sliderValues[key].textContent = formatWavelength(params[key]);
            } else if (key === 'L') {
                sliderValues[key].textContent = formatLength(params[key]);
            } else {
                sliderValues[key].textContent = formatLength(params[key]);
            }
            
            updateSimulation();
        });
    }
    
    function resizeCanvases() {
        const containerWidth = aperturesCanvas.parentElement.clientWidth;
        const aspectRatio = 1; 
        
        aperturesCanvas.width = containerWidth;
        aperturesCanvas.height = containerWidth * aspectRatio;
        
        diffractionCanvas.width = containerWidth;
        diffractionCanvas.height = containerWidth * aspectRatio;
        
        updateSimulation();
    }
    
    window.addEventListener('resize', resizeCanvases);
    
    resizeCanvases();
    
    for (const key in sliders) {
        sliders[key].value = params[key];
        if (key === 'lambda') {
            sliderValues[key].textContent = formatWavelength(params[key]);
        } else if (key === 'L') {
            sliderValues[key].textContent = formatLength(params[key]);
        } else {
            sliderValues[key].textContent = formatLength(params[key]);
        }
    }
    
    
    let useLogScale = true;
    document.addEventListener('keydown', function(event) {
        if (event.key.toLowerCase() === 'l') {
            useLogScale = !useLogScale;
            console.log(`Escala ${useLogScale ? 'logarítmica' : 'lineal'} activada`);
            updateSimulation();
        }
        
        if (event.key.toLowerCase() === 'r') {
            params.a = 97e-6;
            params.b = 97e-6;
            params.R = 53e-6;
            params.D = 200e-6;
            params.lambda = 380e-9;
            params.L = 1.046;
            
            for (const key in sliders) {
                sliders[key].value = params[key];
                if (key === 'lambda') {
                    sliderValues[key].textContent = formatWavelength(params[key]);
                } else {
                    sliderValues[key].textContent = formatLength(params[key]);
                }
            }
            
            updateSimulation();
        }
    });
    
    function exportDiffractionPattern() {
        const data = generateDiffractionPattern(5e-3, 200, params);
        
        const exportData = {
            params: { ...params },
            data: {
                x: data.x,
                y: data.y,
                intensities: data.intensities
            }
        };
        
        const jsonData = JSON.stringify(exportData, null, 2);
        
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `difraccion_fraunhofer_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    

    function savePatternImage() {
        const a = document.createElement('a');
        a.href = diffractionCanvas.toDataURL('image/png');
        a.download = `patron_difraccion_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);
    }
    

    function showAboutInfo() {
        alert("Simulador de Difracción de Fraunhofer\n\n" +
              "Desarrollado para visualizar patrones de difracción en el régimen de Fraunhofer.\n\n" +
              "Controles:\n" +
              "- Ajuste los parámetros usando los deslizadores\n" +
              "- Tecla 'L': Cambiar entre escala lineal y logarítmica\n" +
              "- Tecla 'R': Restablecer parámetros predeterminados");
    }
    
  
});
