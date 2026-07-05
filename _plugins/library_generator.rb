require 'json'

module Jekyll
  class LibraryPageGenerator < Generator
    safe true
    priority :normal

    def generate(site)
      libraries = site.data['libraries'] || load_json(site, '_data/libraries.json')
      regions   = site.data['regions']   || load_json(site, '_data/regions.json')

      return if libraries.empty?

      Jekyll.logger.info "LibraryGenerator:", "#{libraries.size}개 도서관 페이지 생성 중..."

      # 도서관 상세 페이지
      libraries.each do |lib|
        next if lib['slug'].to_s.strip.empty?
        site.pages << LibraryPage.new(site, lib)
      end

      # 지역별 인덱스 구성
      sido_map = {}
      libraries.each do |lib|
        sido = lib['sido']
        sg   = lib['sigungu']
        sido_map[sido] ||= {}
        sido_map[sido][sg] ||= []
        sido_map[sido][sg] << lib
      end

      # 시도 페이지
      regions.each do |region|
        sido      = region['sido']
        sido_slug = region['slug'] || sido
        sido_libs = libraries.select { |l| l['sido'] == sido }
        site.pages << RegionSidoPage.new(site, sido, sido_slug, region['sigungu'], sido_libs)

        # 시군구 페이지
        region['sigungu'].each do |sg_entry|
          sg_name = sg_entry['name']
          sg_slug = sg_entry['slug'] || sg_name
          sg_libs = (sido_map[sido] || {})[sg_name] || []
          site.pages << RegionSigunguPage.new(site, sido, sido_slug, sg_name, sg_slug, sg_libs)
        end
      end

      # 검색 인덱스
      site.pages << SearchIndexPage.new(site, libraries)

      Jekyll.logger.info "LibraryGenerator:", "완료 (도서관 #{libraries.size}개)"
    end

    private

    def load_json(site, path)
      file = File.join(site.source, path)
      return [] unless File.exist?(file)
      JSON.parse(File.read(file, encoding: 'utf-8'))
    rescue => e
      Jekyll.logger.warn "LibraryGenerator:", "#{path} 로드 실패: #{e.message}"
      []
    end
  end

  class LibraryPage < Page
    def initialize(site, lib)
      @site = site
      @base = site.source
      @dir  = "library/#{lib['slug']}"
      @name = 'index.html'

      self.process(@name)
      self.read_yaml(File.join(@base, '_layouts'), 'library.html')
      self.data['layout']      = 'library'
      self.data['title']       = "#{lib['name']} 운영시간 휴관일 열람실 좌석"
      self.data['description'] = build_desc(lib)
      # lib의 name 필드는 lib_name으로 저장 (page.name은 Jekyll 파일명과 충돌)
      lib.each { |k, v| self.data[k == 'name' ? 'lib_name' : k] = v }
    end

    private

    def build_desc(lib)
      return lib['seo_description'] if lib['seo_description'].to_s.length > 10
      name  = lib['name'] || ''
      sido  = lib['sido'] || ''
      sg    = lib['sigungu'] || ''
      hours = lib['hours_weekday'] || ''
      desc  = "#{sido} #{sg} #{name} 운영시간, 휴관일, 열람실 좌석 현황을 확인하세요."
      desc += " 평일 #{hours}" if hours.length > 0
      desc[0, 155]
    end
  end

  class RegionSidoPage < Page
    def initialize(site, sido, sido_slug, sigungu_list, libraries)
      @site = site
      @base = site.source
      @dir  = "region/#{sido_slug}"
      @name = 'index.html'

      self.process(@name)
      self.read_yaml(File.join(@base, '_layouts'), 'region.html')
      self.data['layout']        = 'region'
      self.data['sido']          = sido
      self.data['sido_slug']     = sido_slug
      self.data['sigungu']       = nil
      self.data['library_count'] = libraries.size
      self.data['sigungu_list']  = sigungu_list
      self.data['libraries']     = libraries.first(20)
      self.data['title']         = "#{sido} 도서관 목록 | 우아도서관"
      self.data['description']   = "#{sido} 전체 도서관 #{libraries.size}개 운영시간, 위치, 휴관일 정보."
    end
  end

  class RegionSigunguPage < Page
    def initialize(site, sido, sido_slug, sigungu, sg_slug, libraries)
      @site = site
      @base = site.source
      @dir  = "region/#{sido_slug}/#{sg_slug}"
      @name = 'index.html'

      self.process(@name)
      self.read_yaml(File.join(@base, '_layouts'), 'region.html')
      self.data['layout']        = 'region'
      self.data['sido']          = sido
      self.data['sido_slug']     = sido_slug
      self.data['sigungu']       = sigungu
      self.data['sg_slug']       = sg_slug
      self.data['library_count'] = libraries.size
      self.data['libraries']     = libraries
      self.data['title']         = "#{sido} #{sigungu} 도서관 목록 | 우아도서관"
      self.data['description']   = "#{sido} #{sigungu} 도서관 #{libraries.size}개 운영시간, 위치, 휴관일 정보."
    end
  end

  class SearchIndexPage < Page
    def initialize(site, libraries)
      @site = site
      @base = site.source
      @dir  = ''
      @name = 'search_index.json'

      self.process(@name)
      self.data = { 'layout' => nil, 'sitemap' => false }

      index = libraries.map do |l|
        {
          'slug'           => l['slug'],
          'name'           => l['name'],
          'sido'           => l['sido'],
          'sigungu'        => l['sigungu'],
          'type'           => l['type'],
          'address'        => l['address'],
          'hours'          => l['hours_weekday'],
          'hours_saturday' => l['hours_saturday'],
          'hours_holiday'  => l['hours_holiday'],
          'closed_days'    => l['closed_days'],
          'lat'            => l['lat'].to_s,
          'lng'            => l['lng'].to_s,
          'stdg_cd'        => l['stdg_cd'].to_s,
        }
      end
      self.content = index.to_json
    end

    def output   = self.content
    def render(layouts, registers); end
  end
end
