# Acaora processed-table reproduction runtime. See README.txt.
suppressPackageStartupMessages({library(jsonlite); library(digest)})
canonical_json <- function(value) {
  # Match JSON.stringify's shortest round-tripping numbers and decimal cutoffs.
  if(is.null(value))return('null')
  if(is.character(value)&&length(value)==1&&!is.na(value)) {
    escaped <- vapply(utf8ToInt(enc2utf8(value)),function(code) {
      if(code==34)return('\\"')
      if(code==92)return('\\\\')
      short <- c('8'='\\b','9'='\\t','10'='\\n','12'='\\f','13'='\\r')
      if(as.character(code) %in% names(short))return(unname(short[as.character(code)]))
      if(code<32)return(sprintf('\\u%04x',code))
      intToUtf8(code)
    },'')
    return(paste0('"',paste0(escaped,collapse=''),'"'))
  }
  if(is.logical(value)&&length(value)==1&&!is.na(value))return(if(value)'true' else 'false')
  if(is.numeric(value)&&length(value)==1) {
    if(!is.finite(value))stop('Non-finite verification setting')
    if(value==0)return('0')
    magnitude <- abs(value); token <- NULL
    for(precision in 1:17) {candidate <- sprintf(paste0('%.',precision,'g'),magnitude);if(identical(as.numeric(candidate),as.numeric(magnitude))){token <- candidate;break}}
    parts <- strsplit(tolower(token),'e',fixed=TRUE)[[1]];power <- if(length(parts)==2)as.integer(parts[2]) else 0L
    decimal <- strsplit(parts[1],'.',fixed=TRUE)[[1]];point <- nchar(decimal[1])+power;digits <- sub('0+$','',paste0(decimal,collapse=''))
    if(magnitude>=1e-6&&magnitude<1e21) {
      body <- if(point<=0)paste0('0.',strrep('0',-point),digits) else if(point>=nchar(digits))paste0(digits,strrep('0',point-nchar(digits))) else paste0(substr(digits,1,point),'.',substring(digits,point+1))
    } else {power <- point-1L;body <- paste0(substr(digits,1,1),if(nchar(digits)>1)paste0('.',substring(digits,2)) else '', 'e',if(power>=0)'+' else '',power)}
    return(paste0(if(value<0)'-' else '',body))
  }
  if(is.list(value)) {
    if(is.null(names(value)))return(paste0('[',paste(vapply(value,canonical_json,''),collapse=','),']'))
    keys <- names(value);key_order <- vapply(keys,function(s)paste(sprintf('%02x',as.integer(iconv(s,to='UTF-16BE',toRaw=TRUE)[[1]])),collapse=''),'');keys <- keys[order(key_order,method='radix')]
    return(paste0('{',paste(vapply(keys,function(k)paste0(canonical_json(k),':',canonical_json(value[[k]])),''),collapse=','),'}'))
  }
  stop('Unsupported verification setting')
}
verification_identity <- function(manifest,actual_fingerprint) {
  if(!'verificationIdentity' %in% names(manifest))return(NULL)
  identity <- manifest$verificationIdentity;keys <- c('engine','settingsHash','dataFingerprint','sourceFingerprint')
  if(!is.list(identity)||!setequal(names(identity),keys)||length(identity)!=4||!all(vapply(identity,function(v)is.character(v)&&length(v)==1&&!is.na(v),FALSE)))stop('Invalid verificationIdentity')
  if(!all(vapply(identity[setdiff(keys,'engine')],function(v)grepl('^[a-f0-9]{64}$',v),FALSE)))stop('Invalid verification fingerprint')
  engines <- c(basic='acaora-stats-v2',ols='acaora-ols-v2',advanced='acaora-advanced-v4');a <- manifest$analysis
  if(!a$kind %in% names(engines)||!identical(identity$engine,unname(engines[a$kind])))stop('Verification engine mismatch')
  if(!identical(identity$dataFingerprint,actual_fingerprint))stop('Verification data SHA-256 mismatch')
  settings <- enc2utf8(canonical_json(list(kind=a$kind,config=a$config)))
  if(!identical(identity$settingsHash,digest(charToRaw(settings),algo='sha256',serialize=FALSE)))stop('Verification settings SHA-256 mismatch')
  # sourceFingerprint declares the original source; only the processed table is present.
  identity
}
verification_metrics <- function(a,result) {
  if(a$kind=='basic') {
    keys <- switch(a$config$method,describe=c('n','mean','sd','min','median','max'),relation=c('n','r','p','slope','intercept','r2','t'),NULL)
    if(is.null(keys)||!all(keys %in% names(result)))return(NULL)
    metrics <- lapply(keys,function(k)list(k,result[[k]]))
  } else if(a$kind=='ols') {
    keys <- c(n='n',r2='r2',adjustedR2='adjusted_r2',rmse='residual_se');fields <- c(estimate='coefficients',se='se',t='t',p='p',low='low',high='high',vif='vif')
    if(!all(c(unname(keys),unname(fields),'labels') %in% names(result)))return(NULL)
    labels <- result$labels
    if(!length(labels)||any(vapply(result[unname(fields)],length,0L)!=length(labels)))return(NULL)
    if(identical(labels[1],'Intercept'))labels[1] <- '\u622a\u8ddd'
    if(anyDuplicated(labels))return(NULL)
    metrics <- lapply(names(keys),function(k)list(k,result[[keys[[k]]]]))
    for(i in seq_along(labels))for(k in names(fields))metrics[[length(metrics)+1]] <- list(paste0('coef:',labels[i],':',k),result[[fields[[k]]]][[i]])
  } else return(NULL)
  if(!all(vapply(metrics,function(pair)is.null(pair[[2]])||(is.numeric(pair[[2]])&&length(pair[[2]])==1),FALSE)))return(NULL)
  lapply(metrics,function(pair)list(pair[[1]],if(is.null(pair[[2]])||!is.finite(pair[[2]]))NULL else unname(pair[[2]])))
}
js_sort <- function(x) {
  x <- unique(x)
  key <- vapply(x, function(s) paste(sprintf('%02x',as.integer(iconv(s,to='UTF-16BE',toRaw=TRUE)[[1]])),collapse=''), '')
  x[order(key,method='radix')]
}
lcg <- function(seed) { state <- as.double(seed); function() { state <<- (state*1664525+1013904223) %% 4294967296; state/4294967296 } }
assignments <- function(n,k,random) {
  order <- seq_len(n)
  if(n>1) for(i in n:2) { j <- floor(random()*i)+1; tmp <- order[i]; order[i] <- order[j]; order[j] <- tmp }
  out <- integer(n); offset <- 0
  for(f in seq_len(k)) { size <- n%/%k+as.integer(f<=n%%k); if(size>0) out[order[offset+seq_len(size)]] <- f-1; offset <- offset+size }
  out
}
`%or%` <- function(x,y) if(is.null(x)) y else x
num <- function(v) suppressWarnings(as.numeric(v))
missing_value <- function(v) tolower(trimws(v)) %in% c('','na','null','nan')
required <- function(a) {
  c <- a$config; m <- c$method; predictors <- unlist(c$predictors); cats <- vapply(c$categoricals %or% list(),function(s)s$name,'')
  if(a$kind=='basic') return(if(m=='describe')c$x else if(m=='relation')c(c$x,c$y) else c(c$group,c$value))
  if(a$kind=='ols') return(c(c$outcome,predictors,cats))
  if(m %in% c('pca','kmeans')) return(predictors)
  if(m %in% c('paired','wilcoxon')) return(c(c$outcome,c$second))
  if(m %in% c('anova','welchanova','posthoc','mannwhitney')) return(c(c$outcome,c$group))
  if(m=='bootstrap') return(c(c$outcome,if(c$bootstrapStatistic %or% 'mean' %in% c('paired-difference','correlation'))c$second,if(identical(c$bootstrapStatistic,'difference'))c$group,if(identical(c$bootstrapUnit,'cluster'))c$bootstrapCluster))
  c(c$outcome,predictors,cats,if(m %in% c('cluster','fixed')||identical(c$validation,'group'))c$group,if(m %in% c('cv','classification')&&identical(c$validation,'time'))c$time)
}
design <- function(rows,c,train=rows) {
  predictors <- unlist(c$predictors); x <- matrix(numeric(),nrow=nrow(rows),ncol=0); labels <- predictors
  for(h in predictors) x <- cbind(x,num(rows[,h]))
  for(spec in c$categoricals %or% list()) {
    levels <- js_sort(trimws(train[,spec$name])); ref <- spec$reference
    if(!(ref %in% levels)||length(levels)<2||length(levels)>12)stop('Invalid training categories/reference')
    if(any(!trimws(rows[,spec$name]) %in% levels))stop('Unseen validation category')
    for(level in levels[levels!=ref]) { x <- cbind(x,as.numeric(trimws(rows[,spec$name])==level)); labels <- c(labels,paste0(spec$name,' [',level,' vs ',ref,']')) }
  }
  if(ncol(x)<1||ncol(x)>12)stop('Expanded predictors outside 1..12')
  list(x=x,labels=labels)
}
safe_logistic <- function(x,y) {
  if(!setequal(unique(y),c(0,1)))stop('Both training classes required')
  if(nrow(x)<=ncol(x)||qr(x)$rank!=ncol(x))stop('Insufficient/rank-deficient training design')
  fit <- glm.fit(x,y,family=binomial(),control=glm.control(epsilon=1e-10,maxit=100))
  if(!fit$converged||min(fit$fitted.values*(1-fit$fitted.values))<1e-12)stop('Separation or nonconvergence')
  fit
}
binary_metrics <- function(y,p,threshold) {
  if(!setequal(unique(y),c(0,1)))stop('Both validation classes required')
  positive <- sum(y); negative <- length(y)-positive; order <- order(-p); tp <- fp <- auc <- ap <- lastFpr <- lastRec <- 0
  roc <- list(c(NA,0,0)); pr <- list(c(NA,0,1)); i <- 1
  while(i<=length(order)) {
    j <- i
    while(j<=length(order)&&p[order[j]]==p[order[i]]) {tp <- tp+y[order[j]]; fp <- fp+1-y[order[j]]; j <- j+1}
    rec <- tp/positive; fpr <- fp/negative; precision <- tp/(tp+fp)
    auc <- auc+(fpr-lastFpr)*(rec+lastRec)/2; ap <- ap+(rec-lastRec)*precision
    roc[[length(roc)+1]] <- c(p[order[i]],fpr,rec); pr[[length(pr)+1]] <- c(p[order[i]],rec,precision); lastFpr <- fpr; lastRec <- rec; i <- j
  }
  pred <- p>=threshold; tp <- sum(pred&y==1); fp <- sum(pred&y==0); tn <- sum(!pred&y==0); fn <- sum(!pred&y==1); clipped <- pmin(1-1e-15,pmax(1e-15,p))
  bins <- lapply(0:9,function(b){selected <- pmin(9,floor(p*10))==b;c(b/10,(b+1)/10,sum(selected),if(any(selected))mean(p[selected]) else NA,if(any(selected))mean(y[selected]) else NA)})
  list(auc=auc,ap=ap,brier=mean((p-y)^2),logloss=-mean(y*log(clipped)+(1-y)*log1p(-clipped)),tp=tp,fp=fp,tn=tn,fn=fn,precision=if(tp+fp>0)tp/(tp+fp) else NA,recall=tp/(tp+fn),specificity=tn/(tn+fp),f1=if(2*tp+fp+fn>0)2*tp/(2*tp+fp+fn) else NA,roc=roc,pr=pr,calibration=bins)
}
run_analysis <- function(a,data,verification=FALSE) {
  c <- a$config; m <- if(a$kind=='ols')'ols' else c$method; cols <- required(a)
  if(anyDuplicated(cols)||any(!cols %in% unlist(data$headers)))stop('Invalid required columns')
  raw <- do.call(rbind,lapply(data$rows,unlist)); colnames(raw) <- unlist(data$headers)
  text <- vapply(c$categoricals %or% list(),function(s)s$name,'')
  if(m %in% c('cluster','fixed','anova','welchanova','posthoc','mannwhitney','test')||(m %in% c('cv','classification')&&identical(c$validation,'group'))||(m=='bootstrap'&&identical(c$bootstrapStatistic,'difference')))text <- c(text,c$group)
  if(m=='bootstrap'&&identical(c$bootstrapUnit,'cluster'))text <- c(text,c$bootstrapCluster)
  valid <- rep(TRUE,nrow(raw))
  for(h in cols) valid <- valid&!missing_value(raw[,h])&if(h %in% text)TRUE else is.finite(num(raw[,h]))
  rows <- raw[valid,,drop=FALSE]; n <- nrow(rows); if(n < if(m=='describe')1 else 3)stop('Insufficient complete observations')
  out <- list(method=m,n=n,excluded=nrow(raw)-n,current_table_rows=which(valid)); column <- function(h)num(rows[,h])
  if(m=='describe') {x <- column(c$x);return(c(out,list(mean=mean(x),sd=sd(x),min=min(x),median=median(x),max=max(x),q1=unname(quantile(x,.25)),q3=unname(quantile(x,.75)))))}
  if(m=='relation') {x <- column(c$x);y <- column(c$y);fit <- lm(y~x);s <- summary(fit);out <- c(out,list(r=cor(x,y),coefficients=unname(coef(fit)),p=s$coefficients[2,4],r2=s$r.squared));if(verification)out <- c(out,list(slope=unname(coef(fit)[2]),intercept=unname(coef(fit)[1]),t=s$coefficients[2,3]));return(out)}
  if(m %in% c('paired','wilcoxon')) {
    d <- column(c$outcome)-column(c$second);out$differences <- d
    if(m=='paired') {fit <- t.test(d);out <- c(out,list(estimate=mean(d),se=sd(d)/sqrt(n),t=unname(fit$statistic),p=fit$p.value,df=n-1,low=fit$conf.int[1],high=fit$conf.int[2]))}
    else {d <- d[d!=0];fit <- wilcox.test(d,exact=FALSE,correct=TRUE);w <- min(unname(fit$statistic),length(d)*(length(d)+1)/2-unname(fit$statistic));out <- c(out,list(w=w,p=fit$p.value))}
    return(out)
  }
  if(m %in% c('test','anova','welchanova','posthoc','mannwhitney')) {
    h <- if(m=='test')c$value else c$outcome; groups <- js_sort(trimws(rows[,c$group]));samples <- lapply(groups,function(g)num(rows[trimws(rows[,c$group])==g,h]))
    out$groups <- lapply(seq_along(groups),function(i)list(name=groups[i],n=length(samples[[i]]),mean=mean(samples[[i]]),sd=sd(samples[[i]])))
    if(m %in% c('test','mannwhitney')&&length(groups)!=2)stop('Exactly two groups required')
    if(m=='test') {fit <- t.test(samples[[1]],samples[[2]],var.equal=FALSE);out <- c(out,list(t=unname(fit$statistic),p=fit$p.value,df=unname(fit$parameter)))}
    else if(m=='mannwhitney') {fit <- wilcox.test(samples[[1]],samples[[2]],exact=FALSE,correct=TRUE);out <- c(out,list(u=unname(fit$statistic),p=fit$p.value))}
    else if(m %in% c('anova','welchanova')) {v <- unlist(samples);g <- factor(rep(seq_along(samples),lengths(samples)));fit <- oneway.test(v~g,var.equal=m=='anova');out <- c(out,list(f=unname(fit$statistic),p=fit$p.value,df=unname(fit$parameter)))}
    else {
      pairs <- list()
      for(i in seq_len(length(groups)-1))for(j in (i+1):length(groups)) {
        if(identical(c$posthocFamily,'reference')&&!c$posthocReference %in% groups[c(i,j)])next
        left <- i;right <- j
        if(identical(c$posthocFamily,'reference')&&groups[i]==c$posthocReference){left <- j;right <- i}
        x <- samples[[left]];y <- samples[[right]];fit <- t.test(x,y,var.equal=FALSE)
        pairs[[length(pairs)+1]] <- list(left=groups[left],right=groups[right],estimate=mean(x)-mean(y),se=sqrt(var(x)/length(x)+var(y)/length(y)),t=unname(fit$statistic),df=unname(fit$parameter),p=fit$p.value,low=fit$conf.int[1],high=fit$conf.int[2])
      }
      adjusted <- p.adjust(vapply(pairs,function(p)p$p,0.),'holm');for(i in seq_along(pairs))pairs[[i]]$holm_p <- adjusted[i];out$contrasts <- pairs
    }
    return(out)
  }
  if(m=='bootstrap') {
    stat <- c$bootstrapStatistic %or% 'mean';unit <- c$bootstrapUnit %or% 'row';B <- c$bootstrapIterations %or% 500;random <- lcg(c$seed);groups <- if(stat=='difference')js_sort(trimws(rows[,c$group])) else character()
    if(B<100||B>2000||B*n>20000000)stop('Bootstrap budget exceeded')
    if(stat=='difference'&&length(groups)!=2)stop('Exactly two groups required')
    estimate <- function(sample) {
      x <- num(sample[,c$outcome])
      if(stat=='mean')return(mean(x))
      if(stat=='paired-difference')return(mean(x-num(sample[,c$second])))
      if(stat=='correlation')return(suppressWarnings(cor(x,num(sample[,c$second]))))
      a <- x[trimws(sample[,c$group])==groups[1]];b <- x[trimws(sample[,c$group])==groups[2]]
      if(!length(a)||!length(b))return(NA_real_)
      mean(a)-mean(b)
    }
    if(unit=='cluster') {keys <- unique(trimws(rows[,c$bootstrapCluster]));units <- lapply(keys,function(k)which(trimws(rows[,c$bootstrapCluster])==k));if(length(units)<2)stop('Two subjects required')}
    else units <- if(stat=='difference')lapply(groups,function(g)which(trimws(rows[,c$group])==g)) else list(seq_len(n))
    replicates <- matrix(NA_real_,B,2);visits <- 0
    for(b in seq_len(B)) {
      if(unit=='cluster')indices <- unlist(lapply(seq_along(units),function(j)units[[floor(random()*length(units))+1]]))
      else indices <- unlist(lapply(units,function(g)vapply(seq_along(g),function(j)g[floor(random()*length(g))+1],0)))
      visits <- visits+length(indices);if(unit=='cluster'&&visits>25000000)stop('Actual resampling budget exceeded')
      replicates[b,] <- c(estimate(rows[indices,,drop=FALSE]),length(indices))
    }
    v <- replicates[is.finite(replicates[,1]),1];if(length(v)<B*.95)stop('Fewer than 95% valid replicates')
    return(c(out,list(estimate=estimate(rows),se=sd(v),low=unname(quantile(v,.025)),high=unname(quantile(v,.975)),valid=length(v),failed=B-length(v),replicates=replicates)))
  }
  d <- design(rows,c);x <- d$x;labels <- d$labels
  if(m %in% c('pca','kmeans')) {
    mu <- colMeans(x);sigma <- apply(x,2,sd);z <- scale(x,center=mu,scale=sigma);out <- c(out,list(means=mu,scales=sigma))
    if(m=='pca') {
      fit <- svd(z);v <- fit$v
      for(j in seq_len(ncol(v)))if(v[which.max(abs(v[,j])),j]<0)v[,j] <- -v[,j]
      eigen <- fit$d^2/(n-1);out <- c(out,list(eigenvalues=eigen,explained=eigen/sum(eigen),weights=v[,seq_len(c$components),drop=FALSE],scores=z%*%v[,seq_len(c$components),drop=FALSE]))
    } else {
      k <- c$clusters;random <- lcg(c$seed);best <- NULL
      dist2 <- function(centers) sapply(seq_len(nrow(centers)),function(j)rowSums(sweep(z,2,centers[j,],'-')^2))
      for(attempt in 1:5) {
        centers <- z[floor(random()*n)+1,,drop=FALSE]
        while(nrow(centers)<k){dist <- apply(dist2(centers),1,min);if(max(dist)<=1e-20)stop('Too few distinct patterns');centers <- rbind(centers,z[which.max(dist),])}
        old <- rep(-1,n)
        for(it in 1:200) {
          pred <- max.col(-dist2(centers),ties.method='first');if(any(tabulate(pred,nbins=k)==0))break
          centers <- do.call(rbind,lapply(seq_len(k),function(j)colMeans(z[pred==j,,drop=FALSE])))
          if(all(pred==old)){inertia <- sum((z-centers[pred,,drop=FALSE])^2);if(is.null(best)||inertia<best$inertia)best <- list(inertia=inertia,centers=sweep(sweep(centers,2,sigma,'*'),2,mu,'+'),labels=pred,iterations=it);break};old <- pred
        }
      }
      if(is.null(best))stop('K-means did not converge');out <- c(out,best)
    }
    return(out)
  }
  y <- column(c$outcome)
  if(m %in% c('cv','classification')) {
    k <- c$folds;mode <- c$validation %or% 'random';random <- lcg(c$seed)
    if(mode=='group') {groups <- js_sort(trimws(rows[,c$group]));mapping <- assignments(length(groups),k,random);folds <- mapping[match(trimws(rows[,c$group]),groups)]}
    else if(mode=='time') {
      times <- sort(unique(column(c$time)));if(length(times)<k+1)stop('Insufficient distinct times');mapping <- integer(length(times));offset <- 0
      for(chunk in 0:k){size <- length(times)%/%(k+1)+as.integer(chunk<length(times)%%(k+1));mapping[offset+seq_len(size)] <- chunk-1;offset <- offset+size};folds <- mapping[match(column(c$time),times)]
    } else folds <- assignments(n,k,random)
    predictions <- baseline <- rep(NA_real_,n);details <- list()
    for(f in 0:(k-1)) {
      train <- if(mode=='time')folds<f else folds!=f;held <- folds==f;training <- rows[train,,drop=FALSE]
      dt <- design(training,c,training);xt <- dt$x;xh <- design(rows[held,,drop=FALSE],c,training)$x
      if(m=='classification'){fit <- safe_logistic(cbind(1,xt),y[train]);predictions[held] <- plogis(cbind(1,xh)%*%fit$coefficients)}
      else {mu <- colMeans(xt);sigma <- apply(xt,2,sd);fit <- lm.fit(cbind(1,scale(xt,center=mu,scale=sigma)),y[train]);predictions[held] <- cbind(1,scale(xh,center=mu,scale=sigma))%*%fit$coefficients;baseline[held] <- mean(y[train])}
      details[[f+1]] <- list(fold=f+1,train=sum(train),held=sum(held),labels=dt$labels)
    }
    valid <- is.finite(predictions);out <- c(out,list(folds=folds+1,predictions=predictions,folds_detail=details))
    if(m=='classification')out <- c(out,binary_metrics(y[valid],predictions[valid],c$threshold %or% .5))
    else {e <- y[valid]-predictions[valid];denom <- sum((y[valid]-mean(y[valid]))^2);out <- c(out,list(rmse=sqrt(mean(e^2)),mae=mean(abs(e)),r2=if(denom>0)1-sum(e^2)/denom else NA,baseline_rmse=sqrt(mean((y[valid]-baseline[valid])^2))))}
    return(out)
  }
  if(m=='fixed') {
    keys <- trimws(rows[,c$group]);groups <- js_sort(keys);xd <- x;yd <- y
    for(g in groups){sel <- keys==g;xd[sel,] <- sweep(x[sel,,drop=FALSE],2,colMeans(x[sel,,drop=FALSE]),'-');yd[sel] <- y[sel]-mean(y[sel])}
    fit <- lm.fit(xd,yd);b <- fit$coefficients;e <- fit$residuals;bread <- solve(crossprod(xd));meat <- matrix(0,ncol(x),ncol(x))
    for(g in groups){score <- crossprod(xd[keys==g,,drop=FALSE],e[keys==g]);meat <- meat+tcrossprod(score)}
    df <- n-length(groups)-ncol(x);cov <- bread%*%meat%*%bread*length(groups)/(length(groups)-1)*(n-1)/df;se <- sqrt(diag(cov));t <- b/se;crit <- qt(.975,length(groups)-1)
    return(c(out,list(labels=labels,coefficients=b,se=se,t=t,p=2*pt(-abs(t),length(groups)-1),low=b-crit*se,high=b+crit*se,r2=1-sum(e^2)/sum(yd^2))))
  }
  xx <- cbind(1,x)
  if(m=='logistic'){fit <- safe_logistic(xx,y);class(fit) <- c('glm','lm');s <- summary(fit);b <- fit$coefficients;se <- s$coefficients[,2];t <- b/se;p <- 2*pnorm(-abs(t));crit <- qnorm(.975);out <- c(out,list(predictions=fit$fitted.values,odds_ratio=exp(b)))}
  else {
    fit <- lm.fit(xx,y);b <- fit$coefficients;e <- fit$residuals;pcount <- ncol(xx);bread <- solve(crossprod(xx));df <- n-pcount;meat <- matrix(0,pcount,pcount)
    if(m=='cluster') {
      keys <- trimws(rows[,c$group]);groups <- js_sort(keys)
      for(g in groups){score <- crossprod(xx[keys==g,,drop=FALSE],e[keys==g]);meat <- meat+tcrossprod(score)}
      cov <- bread%*%meat%*%bread*length(groups)/(length(groups)-1)*(n-1)/df;referenceDf <- length(groups)-1
    } else if(identical(c$standardErrors,'HC3')) {
      h <- rowSums((xx%*%bread)*xx);score <- xx*as.vector(e/(1-h));cov <- bread%*%crossprod(score)%*%bread;referenceDf <- df
    } else {cov <- bread*sum(e^2)/df;referenceDf <- df}
    se <- sqrt(diag(cov));t <- b/se;p <- 2*pt(-abs(t),referenceDf);crit <- qt(.975,referenceDf);r2 <- 1-sum(e^2)/sum((y-mean(y))^2)
    out <- c(out,list(r2=r2,adjusted_r2=1-(1-r2)*(n-1)/df,residual_se=sqrt(sum(e^2)/df)))
  }
  if(verification&&a$kind=='ols')out$vif <- c(NA_real_,colSums(sweep(x,2,colMeans(x),'-')^2)*diag(bread)[-1])
  c(out,list(labels=c('Intercept',labels),coefficients=unname(b),se=unname(se),t=unname(t),p=unname(p),low=unname(b-crit*se),high=unname(b+crit*se)))
}
main <- function() {
  manifest <- fromJSON('manifest.json',simplifyVector=FALSE)
  fingerprint <- digest(file='analysis-data.json',algo='sha256')
  if(fingerprint!=manifest$dataset$fingerprint)stop('Data SHA-256 mismatch; export exact analysis-data.json from the workspace')
  identity <- verification_identity(manifest,fingerprint)
  data <- fromJSON('analysis-data.json',simplifyVector=FALSE);result <- run_analysis(manifest$analysis,data,!is.null(identity))
  if(!is.null(identity)) {result$verificationIdentity <- identity;metrics <- verification_metrics(manifest$analysis,result);if(!is.null(metrics))result$verificationMetrics <- metrics}
  result$versions <- list(R=R.version.string,jsonlite=as.character(packageVersion('jsonlite')),digest=as.character(packageVersion('digest')))
  write_json(result,'r-results.json',auto_unbox=TRUE,pretty=TRUE,digits=NA,na='null',null='null');cat('Wrote r-results.json\n')
}
if(!identical(Sys.getenv('ACAORA_REPRO_TEST'),'1'))main()
